import React, { useEffect, useState } from 'react';
import api, { SERVER_ORIGIN } from '../api/axios';
import { getCurrentPosition } from '../utils/geo';
import { SITE_VISIT_STEPS, SITE_VISIT_LOCATION_OPTIONAL_STEPS } from '../constants/leadEnums';
import GeoTaggedPhotoCapture from './GeoTaggedPhotoCapture';
import FormField from './FormField';

const FEEDBACK_STEP = 'Visit Feedback Added';

/**
 * Renders ONE tracker's timeline, plus (only when `canAdvance` is true) the
 * form to confirm its next step. Split out from the list-fetching wrapper
 * below so a lead with multiple Site Visits can render one of these per
 * visit without duplicating the timeline/form markup.
 */
function SiteVisitTrackerPanel({ leadId, tracker, completedSteps, isAgent, canAdvance, onAdvanced }) {
  const [stepInput, setStepInput] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  // Set together with photoFile whenever the photo comes from the camera
  // capture widget below — carries the exact GPS reading taken at the
  // moment of capture, so the step's submitted coordinates always match
  // what's watermarked into the photo itself instead of a second, separate
  // GPS reading.
  const [photoCapture, setPhotoCapture] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [photoError, setPhotoError] = useState('');

  const activeIndex = tracker.currentStepIndex;
  const isComplete = tracker.status === 'completed';
  const activeStepName = SITE_VISIT_STEPS[activeIndex];
  const activeStepLocationOptional = SITE_VISIT_LOCATION_OPTIONAL_STEPS.includes(activeStepName);
  const isFeedbackStep = activeStepName === FEEDBACK_STEP;
  const stepByIndex = (i) => completedSteps.find((s) => s.stepIndex === i);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setStepError('');
    setPhotoError('');
    // The feedback step has its own dedicated text field instead of the
    // "type the step name to confirm" pattern used by every other step.
    if (!isFeedbackStep && !stepInput.trim()) {
      setStepError(`Please type "${activeStepName}" to confirm this step.`);
      return;
    }
    if (activeStepName === 'Photo Uploaded' && !photoFile) {
      setPhotoError('A photo is required before continuing — please attach one.');
      return;
    }
    setSaving(true);
    try {
      // Location is required for every step except the last two (optional) —
      // for those, still try to capture GPS, but don't block saving if it's
      // unavailable or denied. For the Photo Uploaded step specifically, the
      // camera widget already captured a GPS reading at the exact moment the
      // photo was taken (see GeoTaggedPhotoCapture) — reuse that instead of
      // taking a second, possibly slightly different, reading here.
      let lat, lng;
      try {
        if (activeStepName === 'Photo Uploaded' && photoCapture) {
          ({ lat, lng } = photoCapture);
        } else {
          ({ lat, lng } = await getCurrentPosition());
        }
      } catch (geoErr) {
        if (!activeStepLocationOptional) throw geoErr;
      }

      const formData = new FormData();
      formData.append('stepName', isFeedbackStep ? activeStepName : stepInput.trim());
      if (lat !== undefined && lng !== undefined) {
        formData.append('lat', lat);
        formData.append('lng', lng);
      }
      if (photoFile) formData.append('photo', photoFile);
      if (isFeedbackStep && feedbackText.trim()) formData.append('feedback', feedbackText.trim());

      await api.post(`/leads/${leadId}/site-visit-tracker/steps`, formData);
      setStepInput('');
      setFeedbackText('');
      setPhotoFile(null);
      if (photoCapture?.previewUrl) URL.revokeObjectURL(photoCapture.previewUrl);
      setPhotoCapture(null);
      await onAdvanced();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save this step.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="timeline">
        {SITE_VISIT_STEPS.map((name, i) => {
          const done = stepByIndex(i);
          const isActive = i === activeIndex && !isComplete;
          return (
            <div className="tl-item" key={name}>
              <div
                className="tl-dot"
                style={{
                  background: done ? 'var(--green)' : isActive ? 'var(--blue-600)' : 'var(--border)',
                  boxShadow: isActive ? '0 0 0 2px var(--blue-100)' : 'none',
                }}
              />
              <div className="tl-text" style={{ color: done ? 'var(--green)' : isActive ? 'var(--text-900)' : 'var(--text-400)' }}>
                {name}
                {SITE_VISIT_LOCATION_OPTIONAL_STEPS.includes(name) && (
                  <span className="cell-sub" style={{ marginLeft: 6 }}>(Optional)</span>
                )}
                {' '}{done && '✓'} {isActive && <span className="badge blue">Active</span>}
              </div>
              {done && (
                <div className="tl-meta">
                  {done.address} · {new Date(done.createdAt).toLocaleString()}
                  {done.photoUrl && (
                    <>
                      {' · '}
                      <a href={`${SERVER_ORIGIN}${done.photoUrl}`} target="_blank" rel="noreferrer" className="link-btn">View photo</a>
                    </>
                  )}
                  {done.feedback && <div style={{ marginTop: 2 }}>“{done.feedback}”</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isComplete && isAgent && canAdvance && (
        <form onSubmit={handleSave} noValidate style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          {isFeedbackStep ? (
            <FormField label="Feedback (optional)">
              <textarea
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Enter feedback from the site visit..."
              />
            </FormField>
          ) : (
            <FormField
              label="Current Step:"
              required
              error={stepError}
              hint={!stepError && activeStepLocationOptional ? 'Location is optional for this step.' : undefined}
            >
              <input
                value={stepInput}
                onChange={(e) => {
                  const next = e.target.value;
                  setStepInput(next);
                  setStepError(next.trim() ? '' : `Please type "${activeStepName}" to confirm this step.`);
                }}
                onBlur={() => { if (!stepInput.trim()) setStepError(`Please type "${activeStepName}" to confirm this step.`); }}
                placeholder={activeStepName}
              />
            </FormField>
          )}
          {activeStepName === 'Photo Uploaded' && (
            <FormField
              label="Photo — captured live, geotagged with your current location and the date/time"
              required
              error={photoError}
              style={{ marginTop: 10 }}
            >
              <GeoTaggedPhotoCapture
                value={photoCapture}
                onChange={(next) => {
                  setPhotoCapture(next);
                  setPhotoFile(next?.file || null);
                  setPhotoError(next?.file ? '' : 'A photo is required before continuing — please attach one.');
                }}
                disabled={saving}
              />
            </FormField>
          )}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}
      {!isComplete && !isAgent && canAdvance && (
        <p className="cell-sub" style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          Waiting on the assigned agent to confirm the next step.
        </p>
      )}
      {!isComplete && !canAdvance && (
        <p className="cell-sub" style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          This visit was left incomplete before a newer Site Visit was logged — no further steps can be added to it.
        </p>
      )}
    </>
  );
}

/**
 * A Lead can have multiple Site Visits — every "Site Visit" follow-up logged
 * for it starts a brand-new tracker (see backend createTrackerForFollowUp)
 * without touching earlier ones. This fetches all of them and lets the user
 * switch between visits with tabs when there's more than one; only the most
 * recent visit can be advanced (the backend always progresses the latest).
 */
export default function SiteVisitTracker({ leadId, isAgent }) {
  const [trackers, setTrackers] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/leads/${leadId}/site-visit-trackers`);
      const list = data.data || [];
      setTrackers(list);
      setSelected(list.length ? list.length - 1 : 0); // default to the most recent visit
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [leadId]);

  if (loading) return <p className="cell-sub">Loading site visit tracker...</p>;

  if (!trackers.length) {
    return (
      <div className="card" style={{ marginBottom: 20, background: 'var(--bg)' }}>
        <p className="cell-sub" style={{ margin: 0 }}>
          No site visit tracker yet — log a follow-up above with Activity Type "Site Visit" to start one.
        </p>
      </div>
    );
  }

  const activeTracker = trackers[selected];
  const isLatest = selected === trackers.length - 1;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title" style={{ marginBottom: 16 }}>
        Site Visit Tracker
        <span style={{ display: 'block', fontWeight: 400, fontSize: 12, color: 'var(--text-600)' }}>
          {activeTracker.status === 'completed'
            ? 'Visit completed'
            : `Step ${activeTracker.currentStepIndex + 1} of ${SITE_VISIT_STEPS.length}: ${SITE_VISIT_STEPS[activeTracker.currentStepIndex]}`}
        </span>
      </div>

      {/* The project this specific visit is for (see FollowUp/SiteVisitTracker.projectId) —
          shown for both in-progress and completed visits, whenever one was selected. */}
      {activeTracker.project?.name && (
        <div className="cell-sub" style={{ marginBottom: 16 }}>
          <strong style={{ color: 'var(--text-900)' }}>Project:</strong> {activeTracker.project.name}
        </div>
      )}

      {trackers.length > 1 && (
        <div className="row-flex" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {trackers.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`btn ${i === selected ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => setSelected(i)}
            >
              Visit {i + 1}{i === trackers.length - 1 ? ' (Latest)' : ''}
            </button>
          ))}
        </div>
      )}

      <SiteVisitTrackerPanel
        key={activeTracker.id}
        leadId={leadId}
        tracker={activeTracker}
        completedSteps={activeTracker.steps || []}
        isAgent={isAgent}
        canAdvance={isLatest}
        onAdvanced={load}
      />
    </div>
  );
}
