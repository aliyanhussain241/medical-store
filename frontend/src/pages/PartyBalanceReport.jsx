import { businessDay } from '../utils/businessDate';
// ─────────────────────────────────────────────────────────────
// src/pages/PartyBalanceReport.jsx
// Party Wise Balance Report grouped by Area/City (Client Reference Layout)
// S# | CODE | CLOSING | PARTY | TYPE
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, customersAPI, exportAPI, downloadBlob, citiesAPI } from '../api/services';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Printer, FileDown, FileSpreadsheet, Filter, MapPin, Users, DollarSign, Calendar } from 'lucide-react';
import { PageHeader, KpiGrid, KpiCard } from '../components/ui';

function fmtNumber(n) {
  return parseFloat(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fmtDatePK(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function PartyBalanceReport() {
  const { user } = useAuth();
  const todayStr = businessDay();

  const [asOn, setAsOn] = useState(todayStr);
  const [filter, setFilter] = useState('DR'); // 'DR' | 'CR' | 'ALL'
  const [selectedArea, setSelectedArea] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Distinct areas for filter dropdown (customer areas + managed cities)
  const { data: areasData } = useQuery({
    queryKey: ['customer-areas'],
    queryFn: () => customersAPI.areas().then((r) => r.data?.data || []),
  });
  const { data: managedCitiesData } = useQuery({
    queryKey: ['cities-all'],
    queryFn: () => citiesAPI.list({ limit: 100 }).then((r) => (r.data?.data || []).map((c) => c.cityName)),
  });
  const areas = Array.from(new Set([...(areasData || []), ...(managedCitiesData || [])])).filter(Boolean).sort();

  // Report data query
  const { data: reportResp, isLoading, isFetching } = useQuery({
    queryKey: ['party-balance-report', asOn, filter, selectedArea],
    queryFn: () =>
      reportsAPI
        .partyBalance({ asOn, filter, area: selectedArea })
        .then((r) => r.data?.data),
  });

  const reportData = reportResp || {
    asOnDate: asOn,
    filter,
    filterLabel: 'Parties With DR Balances',
    areaGroups: [],
    grandTotal: 0,
    totalCount: 0,
    areaCount: 0,
  };

  const areaGroups = reportData.areaGroups || [];

  async function handleExportPDF() {
    try {
      setExportingPdf(true);
      const res = await exportAPI.partyBalancePDF({ asOn, filter, area: selectedArea });
      downloadBlob(res, `PartyBalance-${asOn}.pdf`);
      toast.success('PDF report downloaded.');
    } catch (err) {
      toast.error('Failed to export PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportExcel() {
    try {
      setExportingExcel(true);
      const res = await exportAPI.partyBalanceExcel({ asOn, filter, area: selectedArea });
      downloadBlob(res, `PartyBalance-${asOn}.xlsx`);
      toast.success('Excel report downloaded.');
    } catch (err) {
      toast.error('Failed to export Excel.');
    } finally {
      setExportingExcel(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const businessName = (user?.businessName || 'RAHMAT MEDICAL WHOLESALE').toUpperCase();
  const city = (user?.city || 'BHIRYA CITY').toUpperCase();

  return (
    <div className="party-balance-page">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }

        .report-paper {
          background: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: var(--radius-md, 8px);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          padding: 24px;
          margin-top: 16px;
        }

        .report-header-banner {
          border-bottom: 2px solid #1e293b;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .report-table th {
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding: 8px 10px;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
        }

        .report-table td {
          padding: 6px 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        .area-header-row td {
          background: #f1f5f9;
          font-weight: 700;
          color: #0f172a;
          font-size: 12px;
          letter-spacing: 0.03em;
          padding: 8px 10px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }

        .area-subtotal-row td {
          background: #fafafa;
          font-weight: 700;
          color: #0f172a;
          padding: 7px 10px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #cbd5e1;
        }

        .grand-total-row td {
          background: #0f172a;
          color: #ffffff;
          font-weight: 800;
          font-size: 14px;
          padding: 10px;
        }
      `}</style>

      {/* Control Bar & Header */}
      <div className="no-print space-y-4 mb-4">
        <PageHeader
          title="Party Wise Balance Report"
          subtitle="Customer ledger balances grouped by territory area with running debit/credit subtotals"
          badge="TERRITORY AUDIT"
          badgeVariant="brand"
          actions={
            <div className="flex gap-2 flex-wrap">
              <button
                id="print-report-btn"
                className="btn btn-outline btn-sm"
                onClick={handlePrint}
                disabled={isLoading || areaGroups.length === 0}
              >
                <Printer size={14} /> Print
              </button>
              <button
                id="export-pdf-btn"
                className="btn btn-outline btn-sm"
                onClick={handleExportPDF}
                disabled={exportingPdf || isLoading || areaGroups.length === 0}
              >
                <FileDown size={14} /> {exportingPdf ? 'Exporting...' : 'PDF'}
              </button>
              <button
                id="export-excel-btn"
                className="btn btn-outline btn-sm"
                onClick={handleExportExcel}
                disabled={exportingExcel || isLoading || areaGroups.length === 0}
              >
                <FileSpreadsheet size={14} /> {exportingExcel ? 'Exporting...' : 'Excel'}
              </button>
            </div>
          }
        />

        {/* Quick KPI Stat Cards */}
        <KpiGrid cols={3}>
          <KpiCard
            title={`Total Balance (${filter})`}
            value={`Rs ${fmtNumber(reportData.grandTotal)}`}
            caption={filter === 'DR' ? 'Total receivables across areas' : filter === 'CR' ? 'Total advances / credits' : 'Net balance across all accounts'}
            icon={DollarSign}
            accentColor={filter === 'DR' ? 'rose' : 'emerald'}
            badge={filter}
          />
          <KpiCard
            title="Parties Listed"
            value={reportData.totalCount}
            caption="Customer accounts in report"
            icon={Users}
            accentColor="brand"
            badge="PARTIES"
          />
          <KpiCard
            title="Active Areas"
            value={reportData.areaCount}
            caption="Districts and market areas"
            icon={MapPin}
            accentColor="blue"
            badge="AREAS"
          />
        </KpiGrid>

        {/* Filter Controls Bar */}
        <div className="app-filter-bar">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            {/* As On Date */}
            <div className="flex items-center gap-2">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1" style={{ marginBottom: 0 }}>
                <Calendar size={13} /> As On:
              </label>
              <input
                id="filter-as-on"
                type="date"
                className="form-input text-sm"
                style={{ width: 150 }}
                value={asOn}
                onChange={(e) => setAsOn(e.target.value)}
              />
            </div>

            {/* Balance Filter */}
            <div className="flex items-center gap-2">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted" style={{ marginBottom: 0 }}>
                Filter:
              </label>
              <select
                id="filter-balance-type"
                className="form-select text-sm font-medium"
                style={{ width: 210 }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="DR">Parties With DR Balances</option>
                <option value="CR">Parties With CR Balances</option>
                <option value="ALL">All Parties (DR & CR)</option>
              </select>
            </div>

            {/* Area Filter */}
            <div className="flex items-center gap-2">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted" style={{ marginBottom: 0 }}>
                Area:
              </label>
              <select
                id="filter-area"
                className="form-select text-sm font-medium"
                style={{ width: 190 }}
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
              >
                <option value="">All Areas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {isFetching && (
              <div className="flex items-center gap-2 text-muted text-xs ml-auto font-medium">
                <span className="spinner" style={{ width: 14, height: 14 }} />
                <span>Updating report...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable / Reference Report Document Preview */}
      <div className="printable-report report-paper" id="report-printable-area">
        {/* Document Header (matches client's sample layout exactly) */}
        <div className="report-header-banner">
          <div className="flex justify-between items-start">
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>
                {businessName}, {city}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                Party Wise Balance Report
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
              <div>Page# 1 of 1</div>
              <div>Dated: {fmtDatePK(todayStr)}</div>
            </div>
          </div>

          <div
            className="flex justify-between items-center text-sm"
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px dashed #cbd5e1',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>As On: </span>
              <span>{fmtDatePK(reportData.asOnDate)}</span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Filter: </span>
              <span>{reportData.filterLabel}</span>
            </div>
            {selectedArea && (
              <div>
                <span style={{ color: '#64748b' }}>Area: </span>
                <span style={{ color: 'var(--primary, #2563eb)' }}>{selectedArea.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Report Content Table */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div className="spinner" style={{ margin: 'auto', width: 28, height: 28 }} />
            <p className="text-muted text-sm" style={{ marginTop: 12 }}>
              Calculating historical party balances as on {fmtDatePK(asOn)}...
            </p>
          </div>
        ) : areaGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No parties found matching the selected criteria.</p>
            <p className="text-xs" style={{ marginTop: 4 }}>
              Try switching the filter to "All Parties" or selecting a different As On date.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ width: 45, textAlign: 'center' }}>S#</th>
                  <th style={{ width: 80, textAlign: 'center' }}>CODE</th>
                  <th style={{ width: 130, textAlign: 'right' }}>CLOSING</th>
                  <th style={{ textAlign: 'left', paddingLeft: 16 }}>PARTY</th>
                  <th style={{ width: 60, textAlign: 'center' }}>TYPE</th>
                </tr>
              </thead>
              <tbody>
                {areaGroups.map((group) => (
                  <AreaGroupSection key={group.area} group={group} />
                ))}

                {/* Grand Total Row */}
                <tr className="grand-total-row">
                  <td colSpan={2} style={{ textAlign: 'left', fontWeight: 800 }}>
                    GRAND TOTAL
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }} className="tabular">
                    {fmtNumber(reportData.grandTotal)}
                  </td>
                  <td colSpan={2} style={{ textAlign: 'right', fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
                    Total {reportData.totalCount} Parties across {reportData.areaCount} Areas
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent for each Area group
function AreaGroupSection({ group }) {
  return (
    <>
      {/* Area Banner Header */}
      <tr className="area-header-row">
        <td colSpan={5}>
          <div className="flex items-center gap-6">
            <span style={{ color: '#2563eb', fontWeight: 800 }}>Area</span>
            <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>{group.area}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginLeft: 8 }}>
              ({group.count} {group.count === 1 ? 'party' : 'parties'})
            </span>
          </div>
        </td>
      </tr>

      {/* Customer Rows */}
      {group.items.map((item) => (
        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
          <td style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>{item.seq}</td>
          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
            {item.code || '0'}
          </td>
          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }} className="tabular">
            {fmtNumber(item.closing)}
          </td>
          <td style={{ textAlign: 'left', paddingLeft: 16 }}>
            <div style={{ fontWeight: 600, color: '#0f172a', textTransform: 'uppercase' }}>
              {item.customerName}
            </div>
            {item.shopName && (
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {item.shopName} {item.phone ? `• ${item.phone}` : ''}
              </div>
            )}
          </td>
          <td style={{ textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                fontWeight: 700,
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 4,
                color: item.balanceType === 'DR' ? '#1e40af' : '#b91c1c',
                background: item.balanceType === 'DR' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              }}
            >
              {item.balanceType}
            </span>
          </td>
        </tr>
      ))}

      {/* Area Subtotal Row */}
      <tr className="area-subtotal-row">
        <td colSpan={2} style={{ textAlign: 'left', fontWeight: 700 }}>
          TOTAL Area {group.area}
        </td>
        <td style={{ textAlign: 'right', fontWeight: 700 }} className="tabular">
          {fmtNumber(group.subtotal)}
        </td>
        <td colSpan={2}></td>
      </tr>
    </>
  );
}
