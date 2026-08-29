'use client';

// Editors for the three syllabus fields the public discussion page renders:
// "What you'll learn?", "Requirements" and the "Course curriculum" accordion.
// Shared by /admin/discussions/create and /admin/manage-discussions/edit/[id],
// which both supply the surrounding .cd-* form styling.

export interface CurriculumModule {
  title: string;
  summary: string;
  items: string[];
}

const REMOVE_ICON = (
  <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const ADD_ICON = (
  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

/* A card of one-line bullets — the shape both `learn` and `requirements` use. */
export function BulletListEditor({
  title,
  hint,
  addLabel,
  placeholder,
  values,
  max = 8,
  onChange,
}: {
  title: string;
  hint?: string;
  addLabel: string;
  placeholder: string;
  values: string[];
  max?: number;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="cd-card">
      <div className="cd-card-title">
        {title} {hint && <span className="cd-label-opt">{hint}</span>}
      </div>
      {values.map((v, i) => (
        <div key={i} className="cd-point-row">
          <input
            className="cd-input cd-point-input"
            placeholder={`${placeholder} ${i + 1}`}
            value={v}
            onChange={e => onChange(values.map((x, k) => (k === i ? e.target.value : x)))}
          />
          {values.length > 1 && (
            <button type="button" className="cd-point-remove" onClick={() => onChange(values.filter((_, k) => k !== i))}>
              {REMOVE_ICON}
            </button>
          )}
        </div>
      ))}
      {values.length < max && (
        <button type="button" className="cd-add-point" onClick={() => onChange([...values, ''])}>
          {ADD_ICON}
          {addLabel}
        </button>
      )}
    </div>
  );
}

/* One accordion tab per module: a title, an optional one-line summary, and the
   lessons listed inside the tab when it is expanded. */
export function CurriculumEditor({
  modules,
  onChange,
  max = 12,
}: {
  modules: CurriculumModule[];
  onChange: (next: CurriculumModule[]) => void;
  max?: number;
}) {
  const patch = (i: number, changes: Partial<CurriculumModule>) =>
    onChange(modules.map((m, k) => (k === i ? { ...m, ...changes } : m)));

  return (
    <div className="cd-card">
      <div className="cd-card-title">
        Course Curriculum <span className="cd-label-opt">(one accordion tab per module)</span>
      </div>

      {modules.length === 0 ? (
        <div className="cd-rev-empty">No modules yet. Add one to build the curriculum accordion.</div>
      ) : (
        modules.map((m, i) => (
          <div key={i} className="cd-mod">
            <div className="cd-mod-head">
              <span className="cd-mod-num">{String(i + 1).padStart(2, '0')}</span>
              <input
                className="cd-input cd-point-input"
                placeholder="Module title"
                value={m.title}
                onChange={e => patch(i, { title: e.target.value })}
              />
              <button type="button" className="cd-point-remove" onClick={() => onChange(modules.filter((_, k) => k !== i))}>
                {REMOVE_ICON}
              </button>
            </div>

            <input
              className="cd-input cd-mod-sum"
              placeholder="Short summary (optional)"
              value={m.summary}
              onChange={e => patch(i, { summary: e.target.value })}
            />

            <div className="cd-mod-lessons">
              <div className="cd-mod-lessons-label">Lessons</div>
              {m.items.map((it, k) => (
                <div key={k} className="cd-point-row">
                  <input
                    className="cd-input cd-point-input"
                    placeholder={`Lesson ${k + 1}`}
                    value={it}
                    onChange={e => patch(i, { items: m.items.map((x, n) => (n === k ? e.target.value : x)) })}
                  />
                  <button
                    type="button"
                    className="cd-point-remove"
                    onClick={() => patch(i, { items: m.items.filter((_, n) => n !== k) })}
                  >
                    {REMOVE_ICON}
                  </button>
                </div>
              ))}
              {m.items.length < 10 && (
                <button type="button" className="cd-add-point" onClick={() => patch(i, { items: [...m.items, ''] })}>
                  {ADD_ICON}
                  Add lesson
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {modules.length < max && (
        <button
          type="button"
          className="cd-add-point"
          onClick={() => onChange([...modules, { title: '', summary: '', items: [''] }])}
        >
          {ADD_ICON}
          Add module
        </button>
      )}

      <style jsx global>{`
        .cd-mod { border: 1px solid #eef2f5; border-radius: 10px; padding: 12px; margin-bottom: 10px; background: #fafcfd; }
        .cd-mod-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .cd-mod-num {
          flex-shrink: 0; width: 28px; height: 28px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          background: #ddf1f3; color: #2a6270;
          font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 600;
        }
        .cd-mod-sum { margin-bottom: 10px; }
        .cd-mod-lessons { padding-left: 36px; border-left: 2px solid #edf2f5; }
        .cd-mod-lessons-label {
          font-family: 'DM Sans', sans-serif; font-size: 0.7rem; font-weight: 600;
          color: #94a7b5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}

/* Drops the blank rows the editors leave behind, mirroring the API's own cleanup. */
export function cleanBullets(values: string[]): string[] {
  return values.map(v => v.trim()).filter(Boolean);
}

export function cleanModules(modules: CurriculumModule[]): CurriculumModule[] {
  return modules
    .map(m => ({ title: m.title.trim(), summary: m.summary.trim(), items: cleanBullets(m.items) }))
    .filter(m => m.title);
}
