import React, { useEffect, useState } from 'react';
import { initials } from '../../components/icons';
import api from '../../api/axios';

/**
 * Clients — one row per successful purchase (see backend
 * controllers/clientController.js), not per lead: a client who bought two
 * units shows up twice, once per unit. Handled By shows the assigned Agent's
 * name if there is one, otherwise the Broker's name — whoever actually
 * created the booking.
 */
export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/clients')
      .then(({ data }) => { if (!cancelled) setClients(data.data || []); })
      .catch(() => { if (!cancelled) setClients([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = clients.filter((c) =>
    c.customerName.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  );

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <div className="filter-input"><input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <span className="cell-sub">{filtered.length} client{filtered.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Clients<span>Leads that have closed — they've bought a project from us</span></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th><th>Phone</th><th>Project Purchased</th><th>Unit</th><th>Handled By</th><th>Purchase Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--green)' }}>{initials(c.customerName)}</div><span className="cell-main">{c.customerName}</span></td>
                  <td className="cell-sub">{c.phone}</td>
                  <td>{c.projectName}</td>
                  <td>{c.unitNo}</td>
                  <td>{c.handledBy}{c.handledByRole === 'broker' && c.handledBy !== '—' ? ' (Broker)' : ''}</td>
                  <td className="cell-sub">{c.purchaseDate ? new Date(c.purchaseDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {loading && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-600)' }}>Loading clients...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No clients yet — leads will show up here once a booking is fully paid.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
