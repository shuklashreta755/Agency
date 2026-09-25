import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { meetingsResource } from '../store/resources';

export default function CalendarView() {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.meetings);

  useEffect(() => { dispatch(meetingsResource.fetchAll()); }, [dispatch]);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay();

  const eventsByDay = useMemo(() => {
    const map = {};
    items.forEach((m) => {
      const d = new Date(m.scheduledAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (map[day] = map[day] || []).push(m);
      }
    });
    return map;
  }, [items, year, month]);

  const cells = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{today.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
      </div>
      <div className="calendar-scroll">
      <div className="calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div className="cal-head" key={d}>{d}</div>)}
        {cells.map((day, idx) => (
          <div key={idx} className={`cal-cell ${day === today.getDate() ? 'today' : ''}`}>
            {day && (
              <>
                <div className="d-num">{day}</div>
                {(eventsByDay[day] || []).slice(0, 3).map((ev) => (
                  <div className="cal-event" key={ev.id} title={ev.title}>{ev.title}</div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
