// SkinProof — thin YouCam API client (AI Skin Analysis + AI Skin Simulation)
// Works in two modes:
//   * proxy  : the bundled server.js holds YOUCAM_API_KEY and forwards /api/s2s/* (key never reaches the browser)
//   * direct : the user pastes their own key in Settings; calls go straight to the YouCam API (CORS is allowed)
// File bytes are always PUT straight to the pre-signed upload URL returned by the File API.

export const REGIONS = {
  india: { label: 'India (makeupar.com)', host: 'https://yce-api-01.makeupar.com' },
  global: { label: 'Global (perfectcorp.com)', host: 'https://yce-api-01.perfectcorp.com' },
};

// SD concerns we request (13 actions => 16 units per analysis on the SD tier)
export const SD_ACTIONS = [
  'acne', 'redness', 'oiliness', 'pore', 'texture', 'moisture', 'radiance',
  'dark_circle_v2', 'eye_bag', 'wrinkle', 'age_spot', 'firmness', 'skin_type',
];

export class YouCamClient {
  constructor({ mode, apiKey, region }) {
    this.mode = mode; // 'proxy' | 'direct'
    this.apiKey = apiKey;
    this.base = mode === 'proxy' ? '/api' : (REGIONS[region] || REGIONS.india).host;
  }

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.mode === 'direct') h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  async call(method, path, body) {
    const res = await fetch(this.base + path, {
      method, headers: this.headers(), body: body ? JSON.stringify(body) : undefined,
    });
    let json;
    try { json = await res.json(); } catch { json = {}; }
    if (!res.ok || (json.status && json.status >= 400)) {
      const msg = json.error || json.message || `HTTP ${res.status}`;
      const err = new Error(friendlyError(json.error_code || msg));
      err.code = json.error_code; throw err;
    }
    return json;
  }

  // 1) File API -> pre-signed URL, 2) PUT bytes, returns file_id
  async upload(blob, name = 'selfie.jpg') {
    const init = await this.call('POST', '/s2s/v2.0/file', {
      files: [{ content_type: blob.type || 'image/jpeg', file_name: name, file_size: blob.size }],
    });
    const f = init.data.files[0];
    const req = f.requests[0];
    const headers = { ...req.headers };
    delete headers['Content-Length']; // browser sets this itself
    const put = await fetch(req.url, { method: req.method || 'PUT', headers, body: blob });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return f.file_id;
  }

  // Start a task and poll until it leaves "running"
  async runTask(kind, body, onTick) {
    const start = await this.call('POST', `/s2s/v2.0/task/${kind}`, body);
    const id = start.data.task_id;
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      await sleep(2500);
      const r = await this.call('GET', `/s2s/v2.0/task/${kind}/${encodeURIComponent(id)}`);
      const st = r.data && r.data.task_status;
      onTick && onTick(st, Date.now() - t0);
      if (st === 'success') return r.data;
      if (st === 'error') throw new Error(friendlyError(r.data.error, r.data.error_message));
    }
    throw new Error('The analysis took too long. Please try again.');
  }

  async analyzeSkin(blob, onTick) {
    const fileId = await this.upload(blob);
    const data = await this.runTask('skin-analysis', {
      src_file_id: fileId, dst_actions: SD_ACTIONS,
      miniserver_args: { enable_mask_overlay: false }, format: 'json',
    }, onTick);
    return normalizeSkin(data);
  }

  // intensities: { acne: 0..1, redness: 0..1, ... } (at least one > 0)
  async simulate(blob, intensities, onTick) {
    const fileId = await this.upload(blob);
    const data = await this.runTask('skin-simulation', { src_file_id: fileId, ...intensities }, onTick);
    return data.results.url;
  }
}

// Turn the raw "format: json" payload into something the UI can use
export function normalizeSkin(data) {
  const out = { scores: {}, skinType: {}, overall: null, skinAge: null, at: new Date().toISOString() };
  for (const o of data.results.output) {
    if (typeof o.ui_score === 'number') {
      out.scores[o.type] = { ui: o.ui_score, raw: +o.raw_score.toFixed(1), mask: (o.mask_urls || [])[0] || null };
    } else if (o.type === 'skin_type') {
      out.skinType[o.region] = o.skin_type;
    } else if (o.type === 'all') {
      out.overall = Math.round(o.score);
    } else if (o.type === 'skin_age') {
      out.skinAge = o.score;
    }
  }
  return out;
}

export function friendlyError(code, detail) {
  const map = {
    error_src_face_too_small: 'Your face looks too small in the photo. Zoom in so your face fills most of the frame width.',
    error_no_face: 'No face found. Use a front-facing selfie in good light.',
    error_pose: 'Please face the camera straight on (no tilt or side angle).',
    error_face_parsing: 'We could not read your face clearly. Try brighter, even light.',
    CreditInsufficiency: 'Your YouCam API account is out of units.',
    InvalidParameters: 'The request was rejected by the API (invalid parameters).',
    exceed_max_filesize: 'The photo is too large. Try a smaller image.',
    error_exceed_max_image_size: 'The photo resolution is too high.',
  };
  return map[code] || detail || code || 'Something went wrong.';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
