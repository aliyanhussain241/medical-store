import{r as e}from"./rolldown-runtime-hePW80VL.js";import{l as t}from"./vendor-charts-DzI0KgKL.js";import{b as n,n as r}from"./vendor-query-DKZ_DrwU.js";import{r as i}from"./vendor-utils-U1zNY8Qv.js";import{t as a}from"./calendar-CONiRobG.js";import{J as o,K as s,O as c,T as l,V as u,Y as d,Z as f,a as p,d as m,i as h,j as g,k as _,nt as v,s as y,x as b}from"./index-BhnOsB_p.js";var x=e(t(),1),S=n();function C(e){return parseFloat(e||0).toLocaleString(`en-PK`,{minimumFractionDigits:0,maximumFractionDigits:2})}function w(e){if(!e)return``;let t=new Date(e);return`${String(t.getDate()).padStart(2,`0`)}/${String(t.getMonth()+1).padStart(2,`0`)}/${t.getFullYear()}`}function T(){let{user:e}=u(),t=new Date().toISOString().slice(0,10),[n,T]=(0,x.useState)(t),[D,O]=(0,x.useState)(`DR`),[k,A]=(0,x.useState)(``),[j,M]=(0,x.useState)(!1),[N,P]=(0,x.useState)(!1),{data:F}=r({queryKey:[`customer-areas`],queryFn:()=>o.areas().then(e=>e.data?.data||[])}),{data:I}=r({queryKey:[`cities-all`],queryFn:()=>s.list({limit:100}).then(e=>(e.data?.data||[]).map(e=>e.cityName))}),L=Array.from(new Set([...F||[],...I||[]])).filter(Boolean).sort(),{data:R,isLoading:z,isFetching:B}=r({queryKey:[`party-balance-report`,n,D,k],queryFn:()=>v.partyBalance({asOn:n,filter:D,area:k}).then(e=>e.data?.data)}),V=R||{asOnDate:n,filter:D,filterLabel:`Parties With DR Balances`,areaGroups:[],grandTotal:0,totalCount:0,areaCount:0},H=V.areaGroups||[];async function U(){try{M(!0);let e=await f.partyBalancePDF({asOn:n,filter:D,area:k});d(e,`PartyBalance-${n}.pdf`),i.success(`PDF report downloaded.`)}catch{i.error(`Failed to export PDF.`)}finally{M(!1)}}async function W(){try{P(!0);let e=await f.partyBalanceExcel({asOn:n,filter:D,area:k});d(e,`PartyBalance-${n}.xlsx`),i.success(`Excel report downloaded.`)}catch{i.error(`Failed to export Excel.`)}finally{P(!1)}}function G(){window.print()}let K=(e?.businessName||`RAHMAT MEDICAL WHOLESALE`).toUpperCase(),q=(e?.city||`BHIRYA CITY`).toUpperCase();return(0,S.jsxs)(`div`,{className:`party-balance-page`,children:[(0,S.jsx)(`style`,{children:`
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
      `}),(0,S.jsxs)(`div`,{className:`no-print space-y-4 mb-4`,children:[(0,S.jsx)(y,{title:`Party Wise Balance Report`,subtitle:`Customer ledger balances grouped by territory area with running debit/credit subtotals`,badge:`TERRITORY AUDIT`,badgeVariant:`brand`,actions:(0,S.jsxs)(`div`,{className:`flex gap-2 flex-wrap`,children:[(0,S.jsxs)(`button`,{id:`print-report-btn`,className:`btn btn-outline btn-sm`,onClick:G,disabled:z||H.length===0,children:[(0,S.jsx)(b,{size:14}),` Print`]}),(0,S.jsxs)(`button`,{id:`export-pdf-btn`,className:`btn btn-outline btn-sm`,onClick:U,disabled:j||z||H.length===0,children:[(0,S.jsx)(_,{size:14}),` `,j?`Exporting...`:`PDF`]}),(0,S.jsxs)(`button`,{id:`export-excel-btn`,className:`btn btn-outline btn-sm`,onClick:W,disabled:N||z||H.length===0,children:[(0,S.jsx)(c,{size:14}),` `,N?`Exporting...`:`Excel`]})]})}),(0,S.jsxs)(h,{cols:3,children:[(0,S.jsx)(p,{title:`Total Balance (${D})`,value:`Rs ${C(V.grandTotal)}`,caption:D===`DR`?`Total receivables across areas`:D===`CR`?`Total advances / credits`:`Net balance across all accounts`,icon:g,accentColor:D===`DR`?`rose`:`emerald`,badge:D}),(0,S.jsx)(p,{title:`Parties Listed`,value:V.totalCount,caption:`Customer accounts in report`,icon:m,accentColor:`brand`,badge:`PARTIES`}),(0,S.jsx)(p,{title:`Active Areas`,value:V.areaCount,caption:`Districts and market areas`,icon:l,accentColor:`blue`,badge:`AREAS`})]}),(0,S.jsx)(`div`,{className:`app-filter-bar`,children:(0,S.jsxs)(`div`,{style:{display:`flex`,gap:16,alignItems:`center`,flexWrap:`wrap`,width:`100%`},children:[(0,S.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,S.jsxs)(`label`,{className:`form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1`,style:{marginBottom:0},children:[(0,S.jsx)(a,{size:13}),` As On:`]}),(0,S.jsx)(`input`,{id:`filter-as-on`,type:`date`,className:`form-input text-sm`,style:{width:150},value:n,onChange:e=>T(e.target.value)})]}),(0,S.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,S.jsx)(`label`,{className:`form-label text-xs font-semibold uppercase tracking-wider text-muted`,style:{marginBottom:0},children:`Filter:`}),(0,S.jsxs)(`select`,{id:`filter-balance-type`,className:`form-select text-sm font-medium`,style:{width:210},value:D,onChange:e=>O(e.target.value),children:[(0,S.jsx)(`option`,{value:`DR`,children:`Parties With DR Balances`}),(0,S.jsx)(`option`,{value:`CR`,children:`Parties With CR Balances`}),(0,S.jsx)(`option`,{value:`ALL`,children:`All Parties (DR & CR)`})]})]}),(0,S.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,S.jsx)(`label`,{className:`form-label text-xs font-semibold uppercase tracking-wider text-muted`,style:{marginBottom:0},children:`Area:`}),(0,S.jsxs)(`select`,{id:`filter-area`,className:`form-select text-sm font-medium`,style:{width:190},value:k,onChange:e=>A(e.target.value),children:[(0,S.jsx)(`option`,{value:``,children:`All Areas`}),L.map(e=>(0,S.jsx)(`option`,{value:e,children:e},e))]})]}),B&&(0,S.jsxs)(`div`,{className:`flex items-center gap-2 text-muted text-xs ml-auto font-medium`,children:[(0,S.jsx)(`span`,{className:`spinner`,style:{width:14,height:14}}),(0,S.jsx)(`span`,{children:`Updating report...`})]})]})})]}),(0,S.jsxs)(`div`,{className:`printable-report report-paper`,id:`report-printable-area`,children:[(0,S.jsxs)(`div`,{className:`report-header-banner`,children:[(0,S.jsxs)(`div`,{className:`flex justify-between items-start`,children:[(0,S.jsxs)(`div`,{children:[(0,S.jsxs)(`div`,{style:{fontSize:16,fontWeight:800,color:`#0f172a`,letterSpacing:`0.02em`},children:[K,`, `,q]}),(0,S.jsx)(`div`,{style:{fontSize:18,fontWeight:700,color:`#1e293b`,marginTop:2},children:`Party Wise Balance Report`})]}),(0,S.jsxs)(`div`,{style:{textAlign:`right`,fontSize:11,color:`#64748b`},children:[(0,S.jsx)(`div`,{children:`Page# 1 of 1`}),(0,S.jsxs)(`div`,{children:[`Dated: `,w(t)]})]})]}),(0,S.jsxs)(`div`,{className:`flex justify-between items-center text-sm`,style:{marginTop:10,paddingTop:8,borderTop:`1px dashed #cbd5e1`,color:`#334155`,fontSize:12,fontWeight:600},children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`span`,{style:{color:`#64748b`},children:`As On: `}),(0,S.jsx)(`span`,{children:w(V.asOnDate)})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`span`,{style:{color:`#64748b`},children:`Filter: `}),(0,S.jsx)(`span`,{children:V.filterLabel})]}),k&&(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`span`,{style:{color:`#64748b`},children:`Area: `}),(0,S.jsx)(`span`,{style:{color:`var(--primary, #2563eb)`},children:k.toUpperCase()})]})]})]}),z?(0,S.jsxs)(`div`,{style:{textAlign:`center`,padding:`48px 0`},children:[(0,S.jsx)(`div`,{className:`spinner`,style:{margin:`auto`,width:28,height:28}}),(0,S.jsxs)(`p`,{className:`text-muted text-sm`,style:{marginTop:12},children:[`Calculating historical party balances as on `,w(n),`...`]})]}):H.length===0?(0,S.jsxs)(`div`,{style:{textAlign:`center`,padding:`48px 0`,color:`#64748b`},children:[(0,S.jsx)(`p`,{style:{fontSize:15,fontWeight:600},children:`No parties found matching the selected criteria.`}),(0,S.jsx)(`p`,{className:`text-xs`,style:{marginTop:4},children:`Try switching the filter to "All Parties" or selecting a different As On date.`})]}):(0,S.jsx)(`div`,{style:{overflowX:`auto`},children:(0,S.jsxs)(`table`,{className:`report-table`,children:[(0,S.jsx)(`thead`,{children:(0,S.jsxs)(`tr`,{children:[(0,S.jsx)(`th`,{style:{width:45,textAlign:`center`},children:`S#`}),(0,S.jsx)(`th`,{style:{width:80,textAlign:`center`},children:`CODE`}),(0,S.jsx)(`th`,{style:{width:130,textAlign:`right`},children:`CLOSING`}),(0,S.jsx)(`th`,{style:{textAlign:`left`,paddingLeft:16},children:`PARTY`}),(0,S.jsx)(`th`,{style:{width:60,textAlign:`center`},children:`TYPE`})]})}),(0,S.jsxs)(`tbody`,{children:[H.map(e=>(0,S.jsx)(E,{group:e},e.area)),(0,S.jsxs)(`tr`,{className:`grand-total-row`,children:[(0,S.jsx)(`td`,{colSpan:2,style:{textAlign:`left`,fontWeight:800},children:`GRAND TOTAL`}),(0,S.jsx)(`td`,{style:{textAlign:`right`,fontWeight:800},className:`tabular`,children:C(V.grandTotal)}),(0,S.jsxs)(`td`,{colSpan:2,style:{textAlign:`right`,fontSize:11,fontWeight:500,opacity:.85},children:[`Total `,V.totalCount,` Parties across `,V.areaCount,` Areas`]})]})]})]})})]})]})}function E({group:e}){return(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(`tr`,{className:`area-header-row`,children:(0,S.jsx)(`td`,{colSpan:5,children:(0,S.jsxs)(`div`,{className:`flex items-center gap-6`,children:[(0,S.jsx)(`span`,{style:{color:`#2563eb`,fontWeight:800},children:`Area`}),(0,S.jsx)(`span`,{style:{fontWeight:800,textTransform:`uppercase`},children:e.area}),(0,S.jsxs)(`span`,{style:{fontSize:11,fontWeight:500,color:`#64748b`,marginLeft:8},children:[`(`,e.count,` `,e.count===1?`party`:`parties`,`)`]})]})})}),e.items.map(e=>(0,S.jsxs)(`tr`,{className:`hover:bg-slate-50 transition-colors`,children:[(0,S.jsx)(`td`,{style:{textAlign:`center`,color:`#64748b`,fontSize:12},children:e.seq}),(0,S.jsx)(`td`,{style:{textAlign:`center`,fontFamily:`monospace`,fontWeight:600,color:`#334155`},children:e.code||`0`}),(0,S.jsx)(`td`,{style:{textAlign:`right`,fontWeight:700,color:`#0f172a`},className:`tabular`,children:C(e.closing)}),(0,S.jsxs)(`td`,{style:{textAlign:`left`,paddingLeft:16},children:[(0,S.jsx)(`div`,{style:{fontWeight:600,color:`#0f172a`,textTransform:`uppercase`},children:e.customerName}),e.shopName&&(0,S.jsxs)(`div`,{style:{fontSize:11,color:`#64748b`},children:[e.shopName,` `,e.phone?`• ${e.phone}`:``]})]}),(0,S.jsx)(`td`,{style:{textAlign:`center`},children:(0,S.jsx)(`span`,{style:{display:`inline-block`,fontWeight:700,fontSize:11,padding:`1px 6px`,borderRadius:4,color:e.balanceType===`DR`?`#1e40af`:`#b91c1c`,background:e.balanceType===`DR`?`rgba(37, 99, 235, 0.08)`:`rgba(239, 68, 68, 0.08)`},children:e.balanceType})})]},e.id)),(0,S.jsxs)(`tr`,{className:`area-subtotal-row`,children:[(0,S.jsxs)(`td`,{colSpan:2,style:{textAlign:`left`,fontWeight:700},children:[`TOTAL Area `,e.area]}),(0,S.jsx)(`td`,{style:{textAlign:`right`,fontWeight:700},className:`tabular`,children:C(e.subtotal)}),(0,S.jsx)(`td`,{colSpan:2})]})]})}export{T as default};