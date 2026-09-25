// import React, { useEffect, useRef, useState } from 'react';
// import { getCurrentPosition } from '../utils/geo';

// /**
//  * Camera-based photo capture used by the Site Visit Tracker's "Photo
//  * Uploaded" step. Opens the device camera, lets the agent take a photo,
//  * permanently burns the exact GPS coordinates + date/time into the image
//  * pixels via <canvas> (not just EXIF metadata, so the geotag survives being
//  * shared/re-saved/stripped elsewhere), then hands the finished file up to
//  * the parent via `onChange`. Deliberately generic/reusable — it knows
//  * nothing about Site Visits specifically, just "capture + geotag + confirm
//  * one photo" — so it can be dropped into any other flow that needs the same
//  * thing later.
//  *
//  * @param {{lat:number,lng:number,capturedAt:string,previewUrl:string,file:File}|null} value
//  *   The currently confirmed photo, or null if none has been confirmed yet.
//  *   Owned by the parent — this component only manages the in-progress
//  *   camera/preview UI and reports back once the agent confirms a shot.
//  * @param {(next: typeof value) => void} onChange
//  *   Called with the confirmed capture, or null (e.g. on Retake).
//  * @param {boolean} [disabled] - hides all controls, e.g. while the step is being saved.
//  */
// export default function GeoTaggedPhotoCapture({ value, onChange, disabled }) {
//   const [phase, setPhase] = useState('idle'); // 'idle' | 'starting' | 'streaming' | 'capturing'
//   const [draft, setDraft] = useState(null); // captured-but-not-yet-confirmed { previewUrl, file, lat, lng, capturedAt }
//   const [error, setError] = useState('');

//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const streamRef = useRef(null);
//   const draftRef = useRef(null);
//   useEffect(() => { draftRef.current = draft; }, [draft]);

//   const stopCamera = () => {
//     streamRef.current?.getTracks().forEach((t) => t.stop());
//     streamRef.current = null;
//     if (videoRef.current) videoRef.current.srcObject = null;
//   };

//   // Always release the camera (and any not-yet-confirmed preview) when this
//   // field leaves the screen — step advances, tab changes, etc. Never leave
//   // the camera light on in the background, and never leak a blob URL.
//   useEffect(() => () => {
//     stopCamera();
//     if (draftRef.current?.previewUrl) URL.revokeObjectURL(draftRef.current.previewUrl);
//   }, []);

//   const openCamera = async () => {
//     setError('');
//     if (!navigator.mediaDevices?.getUserMedia) {
//       setError('Camera access is not supported in this browser.');
//       return;
//     }
//     setPhase('starting');
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: { ideal: 'environment' } },
//         audio: false,
//       });
//       streamRef.current = stream;
//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//         await videoRef.current.play();
//       }
//       setPhase('streaming');
//     } catch (err) {
//       setPhase('idle');
//       if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
//         setError('Camera access was denied. Please allow camera access in your browser settings and try again.');
//       } else if (err.name === 'NotFoundError') {
//         setError('No camera was found on this device.');
//       } else {
//         setError('Could not access the camera. Please try again.');
//       }
//     }
//   };

//   const cancelStreaming = () => {
//     stopCamera();
//     setPhase('idle');
//   };

//   const capturePhoto = async () => {
//     if (!videoRef.current) return;
//     setError('');
//     setPhase('capturing');
//     try {
//       // GPS is read at the moment of capture (not when the camera was
//       // opened) so the watermark reflects exactly where the agent was when
//       // the shutter went off.
//       const { lat, lng } = await getCurrentPosition();

//       const video = videoRef.current;
//       const canvas = canvasRef.current;
//       canvas.width = video.videoWidth || 1280;
//       canvas.height = video.videoHeight || 720;
//       const ctx = canvas.getContext('2d');
//       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//       const capturedAt = new Date();
//       const lines = [
//         `Lat: ${lat.toFixed(6)}   Lng: ${lng.toFixed(6)}`,
//         capturedAt.toLocaleString(),
//       ];
//       const fontSize = Math.max(16, Math.round(canvas.width * 0.022));
//       const padding = Math.round(fontSize * 0.6);
//       const lineHeight = fontSize * 1.35;
//       const bandHeight = padding * 2 + lineHeight * lines.length;

//       ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
//       ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
//       ctx.fillStyle = '#ffffff';
//       ctx.font = `${fontSize}px sans-serif`;
//       ctx.textBaseline = 'top';
//       lines.forEach((line, i) => {
//         ctx.fillText(line, padding, canvas.height - bandHeight + padding + i * lineHeight);
//       });

//       canvas.toBlob((blob) => {
//         if (!blob) {
//           setError('Could not process the photo. Please try again.');
//           setPhase('streaming');
//           return;
//         }
//         stopCamera();
//         const previewUrl = URL.createObjectURL(blob);
//         const file = new File([blob], `site-visit-${capturedAt.getTime()}.jpg`, { type: 'image/jpeg' });
//         setDraft({ previewUrl, file, lat, lng, capturedAt: capturedAt.toISOString() });
//         setPhase('idle');
//       }, 'image/jpeg', 0.92);
//     } catch (geoErr) {
//       // Camera stays open so the agent can just try capturing again once
//       // location access is sorted out, instead of having to reopen it.
//       setPhase('streaming');
//       setError(geoErr.message || 'Could not read your current location. Please enable location access and try again.');
//     }
//   };

//   const discardDraft = () => {
//     if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
//     setDraft(null);
//   };

//   const retake = () => {
//     discardDraft();
//     if (value) onChange(null);
//     setError('');
//     openCamera();
//   };

//   const confirmDraft = () => {
//     onChange(draft);
//     setDraft(null); // ownership passes to `value`; nothing left to revoke here
//   };

//   if (disabled) return null;

//   const showVideo = !value && !draft && (phase === 'streaming' || phase === 'capturing');

//   let controls;
//   if (value) {
//     // 1. A photo has already been confirmed up to the parent form.
//     controls = (
//       <div>
//         <img src={value.previewUrl} alt="Captured site visit" style={{ maxWidth: 260, borderRadius: 8, display: 'block' }} />
//         <div className="cell-sub" style={{ marginTop: 6 }}>
//           Captured {new Date(value.capturedAt).toLocaleString()} · {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
//         </div>
//         <button type="button" className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12, padding: '6px 12px' }} onClick={retake}>
//           Retake Photo
//         </button>
//       </div>
//     );
//   } else if (draft) {
//     // 2. Just captured, waiting for the agent to confirm or retake it.
//     controls = (
//       <div>
//         <img src={draft.previewUrl} alt="Preview" style={{ maxWidth: 260, borderRadius: 8, display: 'block' }} />
//         <div className="row-flex" style={{ gap: 8, marginTop: 8 }}>
//           <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={retake}>
//             Retake Photo
//           </button>
//           <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={confirmDraft}>
//             Upload Photo
//           </button>
//         </div>
//       </div>
//     );
//   } else if (showVideo) {
//     // 3. Live camera preview, ready to snap.
//     controls = (
//       <div className="row-flex" style={{ gap: 8, marginTop: 8 }}>
//         <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={cancelStreaming} disabled={phase === 'capturing'}>
//           Cancel
//         </button>
//         <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={capturePhoto} disabled={phase === 'capturing'}>
//           {phase === 'capturing' ? 'Capturing…' : 'Capture Photo'}
//         </button>
//       </div>
//     );
//   } else {
//     // 4. Idle — nothing captured yet.
//     controls = (
//       <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={openCamera} disabled={phase === 'starting'}>
//         {phase === 'starting' ? 'Opening camera…' : 'Open Camera'}
//       </button>
//     );
//   }

//   return (
//     <div>
//       {/* <video> and <canvas> are always mounted (visibility toggled via CSS,
//           not conditional rendering) so their refs are already attached by
//           the time openCamera()/capturePhoto() need them — getUserMedia and
//           canvas drawing both require a real element to target. */}
//       <video
//         ref={videoRef}
//         playsInline
//         muted
//         style={{ width: '100%', maxWidth: 320, borderRadius: 8, background: '#000', display: showVideo ? 'block' : 'none' }}
//       />
//       <canvas ref={canvasRef} style={{ display: 'none' }} />
//       {controls}
//       {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
//     </div>
//   );
// }


















import React, { useEffect, useRef, useState } from 'react';
import { getCurrentPosition } from '../utils/geo';
import { reverseGeocode } from '../utils/geocode';

// Greedily wraps `text` onto at most `maxLines` lines no wider than
// `maxWidth` (canvas pixels, per `ctx`'s current font) — addresses vary a lot
// in length, so the watermark band needs to fit whatever comes back instead
// of assuming a single short line like "Lat: ... Lng: ...\" always did.
// Truncates with an ellipsis on the last line if it still doesn't fit.
function wrapAddressLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) { current = ''; break; }
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && current) {
    // There's still leftover text past what fit — mark the last line as cut off.
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

/**
 * Camera-based photo capture used by the Site Visit Tracker's "Photo
 * Uploaded" step. Opens the device camera, lets the agent take a photo,
 * permanently burns the exact GPS coordinates + date/time into the image
 * pixels via <canvas> (not just EXIF metadata, so the geotag survives being
 * shared/re-saved/stripped elsewhere), then hands the finished file up to
 * the parent via `onChange`. Deliberately generic/reusable — it knows
 * nothing about Site Visits specifically, just "capture + geotag + confirm
 * one photo" — so it can be dropped into any other flow that needs the same
 * thing later.
 *
 * @param {{lat:number,lng:number,capturedAt:string,previewUrl:string,file:File}|null} value
 *   The currently confirmed photo, or null if none has been confirmed yet.
 *   Owned by the parent — this component only manages the in-progress
 *   camera/preview UI and reports back once the agent confirms a shot.
 * @param {(next: typeof value) => void} onChange
 *   Called with the confirmed capture, or null (e.g. on Retake).
 * @param {boolean} [disabled] - hides all controls, e.g. while the step is being saved.
 */
export default function GeoTaggedPhotoCapture({ value, onChange, disabled }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'starting' | 'streaming' | 'capturing'
  const [draft, setDraft] = useState(null); // captured-but-not-yet-confirmed { previewUrl, file, lat, lng, capturedAt }
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const draftRef = useRef(null);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Always release the camera (and any not-yet-confirmed preview) when this
  // field leaves the screen — step advances, tab changes, etc. Never leave
  // the camera light on in the background, and never leak a blob URL.
  useEffect(() => () => {
    stopCamera();
    if (draftRef.current?.previewUrl) URL.revokeObjectURL(draftRef.current.previewUrl);
  }, []);

  const openCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.');
      return;
    }
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('streaming');
    } catch (err) {
      setPhase('idle');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access was denied. Please allow camera access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera was found on this device.');
      } else {
        setError('Could not access the camera. Please try again.');
      }
    }
  };

  const cancelStreaming = () => {
    stopCamera();
    setPhase('idle');
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setError('');
    setPhase('capturing');
    try {
      // GPS is read at the moment of capture (not when the camera was
      // opened) so the watermark reflects exactly where the agent was when
      // the shutter went off.
      const { lat, lng } = await getCurrentPosition();
      // Resolve the coordinate to a human-readable address for the
      // watermark, the same reverse-geocoding used for Agent Tracking.
      // Falls back to raw coordinates if it's unavailable (e.g. offline),
      // so the watermark always shows something.
      const address = await reverseGeocode(lat, lng);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const capturedAt = new Date();
      const fontSize = Math.max(16, Math.round(canvas.width * 0.022));
      const padding = Math.round(fontSize * 0.6);
      const lineHeight = fontSize * 1.35;
      ctx.font = `${fontSize}px sans-serif`;

      const maxLineWidth = canvas.width - padding * 2;
      const locationLines = wrapAddressLines(
        ctx,
        address || `Lat: ${lat.toFixed(6)}   Lng: ${lng.toFixed(6)}`,
        maxLineWidth,
        2
      );
      const lines = [...locationLines, capturedAt.toLocaleString()];
      const bandHeight = padding * 2 + lineHeight * lines.length;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => {
        ctx.fillText(line, padding, canvas.height - bandHeight + padding + i * lineHeight);
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Could not process the photo. Please try again.');
          setPhase('streaming');
          return;
        }
        stopCamera();
        const previewUrl = URL.createObjectURL(blob);
        const file = new File([blob], `site-visit-${capturedAt.getTime()}.jpg`, { type: 'image/jpeg' });
        setDraft({ previewUrl, file, lat, lng, capturedAt: capturedAt.toISOString() });
        setPhase('idle');
      }, 'image/jpeg', 0.92);
    } catch (geoErr) {
      // Camera stays open so the agent can just try capturing again once
      // location access is sorted out, instead of having to reopen it.
      setPhase('streaming');
      setError(geoErr.message || 'Could not read your current location. Please enable location access and try again.');
    }
  };

  const discardDraft = () => {
    if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setDraft(null);
  };

  const retake = () => {
    discardDraft();
    if (value) onChange(null);
    setError('');
    openCamera();
  };

  const confirmDraft = () => {
    onChange(draft);
    setDraft(null); // ownership passes to `value`; nothing left to revoke here
  };

  if (disabled) return null;

  const showVideo = !value && !draft && (phase === 'streaming' || phase === 'capturing');

  let controls;
  if (value) {
    // 1. A photo has already been confirmed up to the parent form.
    controls = (
      <div>
        <img src={value.previewUrl} alt="Captured site visit" style={{ maxWidth: 260, borderRadius: 8, display: 'block' }} />
        <div className="cell-sub" style={{ marginTop: 6 }}>
          Captured {new Date(value.capturedAt).toLocaleString()} · {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </div>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12, padding: '6px 12px' }} onClick={retake}>
          Retake Photo
        </button>
      </div>
    );
  } else if (draft) {
    // 2. Just captured, waiting for the agent to confirm or retake it.
    controls = (
      <div>
        <img src={draft.previewUrl} alt="Preview" style={{ maxWidth: 260, borderRadius: 8, display: 'block' }} />
        <div className="row-flex" style={{ gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={retake}>
            Retake Photo
          </button>
          <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={confirmDraft}>
            Upload Photo
          </button>
        </div>
      </div>
    );
  } else if (showVideo) {
    // 3. Live camera preview, ready to snap.
    controls = (
      <div className="row-flex" style={{ gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={cancelStreaming} disabled={phase === 'capturing'}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={capturePhoto} disabled={phase === 'capturing'}>
          {phase === 'capturing' ? 'Capturing…' : 'Capture Photo'}
        </button>
      </div>
    );
  } else {
    // 4. Idle — nothing captured yet.
    controls = (
      <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={openCamera} disabled={phase === 'starting'}>
        {phase === 'starting' ? 'Opening camera…' : 'Open Camera'}
      </button>
    );
  }

  return (
    <div>
      {/* <video> and <canvas> are always mounted (visibility toggled via CSS,
          not conditional rendering) so their refs are already attached by
          the time openCamera()/capturePhoto() need them — getUserMedia and
          canvas drawing both require a real element to target. */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: '100%', maxWidth: 320, borderRadius: 8, background: '#000', display: showVideo ? 'block' : 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {controls}
      {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}







