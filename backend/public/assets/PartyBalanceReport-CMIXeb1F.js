import{r as e}from"./rolldown-runtime-hePW80VL.js";import{l as t}from"./vendor-charts-DzI0KgKL.js";import{b as n,n as r}from"./vendor-query-DKZ_DrwU.js";import{r as i}from"./vendor-utils-U1zNY8Qv.js";import{t as a}from"./calendar-D_Uc4Yv6.js";import{$ as o,A as s,E as c,I as l,K as u,N as d,P as f,Z as p,a as m,d as h,et as g,h as _,i as v,nt as y,s as b,st as x}from"./index-DCl-EnXU.js";var S=e(t(),1),C=n();function w(e){return parseFloat(e||0).toLocaleString(`en-PK`,{minimumFractionDigits:0,maximumFractionDigits:2})}function T(e){if(!e)return``;let t=new Date(e);return`${String(t.getDate()).padStart(2,`0`)}/${String(t.getMonth()+1).padStart(2,`0`)}/${t.getFullYear()}`}function E(){let{user:e}=u(),t=h(),[n,E]=(0,S.useState)(t),[O,k]=(0,S.useState)(`DR`),[A,j]=(0,S.useState)(``),[M,N]=(0,S.useState)(!1),[P,F]=(0,S.useState)(!1),{data:I}=r({queryKey:[`customer-areas`],queryFn:()=>o.areas().then(e=>e.data?.data||[])}),{data:L}=r({queryKey:[`cities-all`],queryFn:()=>p.list({limit:100}).then(e=>(e.data?.data||[]).map(e=>e.cityName))}),R=Array.from(new Set([...I||[],...L||[]])).filter(Boolean).sort(),{data:z,isLoading:B,isFetching:V}=r({queryKey:[`party-balance-report`,n,O,A],queryFn:()=>x.partyBalance({asOn:n,filter:O,area:A}).then(e=>e.data?.data)}),H=z||{asOnDate:n,filter:O,filterLabel:`Parties With DR Balances`,areaGroups:[],grandTotal:0,totalCount:0,areaCount:0},U=H.areaGroups||[];async function W(){try{N(!0);let e=await y.partyBalancePDF({asOn:n,filter:O,area:A});g(e,`PartyBalance-${n}.pdf`),i.success(`PDF report downloaded.`)}catch{i.error(`Failed to export PDF.`)}finally{N(!1)}}async function G(){try{F(!0);let e=await y.partyBalanceExcel({asOn:n,filter:O,area:A});g(e,`PartyBalance-${n}.xlsx`),i.success(`Excel report downloaded.`)}catch{i.error(`Failed to export Excel.`)}finally{F(!1)}}function K(){window.print()}let q=(e?.businessName||`RAHMAT MEDICAL WHOLESALE`).toUpperCase(),J=(e?.city||`BHIRYA CITY`).toUpperCase();return(0,C.jsxs)(`div`,{className:`party-balance-page`,children:[(0,C.jsx)(`style`,{children:`
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
      `}),(0,C.jsxs)(`div`,{className:`no-print space-y-4 mb-4`,children:[(0,C.jsx)(b,{title:`Party Wise Balance Report`,subtitle:`Customer ledger balances grouped by territory area with running debit/credit subtotals`,badge:`TERRITORY AUDIT`,badgeVariant:`brand`,actions:(0,C.jsxs)(`div`,{className:`flex gap-2 flex-wrap`,children:[(0,C.jsxs)(`button`,{id:`print-report-btn`,className:`btn btn-outline btn-sm`,onClick:K,disabled:B||U.length===0,children:[(0,C.jsx)(c,{size:14}),` Print`]}),(0,C.jsxs)(`button`,{id:`export-pdf-btn`,className:`btn btn-outline btn-sm`,onClick:W,disabled:M||B||U.length===0,children:[(0,C.jsx)(f,{size:14}),` `,M?`Exporting...`:`PDF`]}),(0,C.jsxs)(`button`,{id:`export-excel-btn`,className:`btn btn-outline btn-sm`,onClick:G,disabled:P||B||U.length===0,children:[(0,C.jsx)(d,{size:14}),` `,P?`Exporting...`:`Excel`]})]})}),(0,C.jsxs)(v,{cols:3,children:[(0,C.jsx)(m,{title:`Total Balance (${O})`,value:`Rs ${w(H.grandTotal)}`,caption:O===`DR`?`Total receivables across areas`:O===`CR`?`Total advances / credits`:`Net balance across all accounts`,icon:l,accentColor:O===`DR`?`rose`:`emerald`,badge:O}),(0,C.jsx)(m,{title:`Parties Listed`,value:H.totalCount,caption:`Customer accounts in report`,icon:_,accentColor:`brand`,badge:`PARTIES`}),(0,C.jsx)(m,{title:`Active Areas`,value:H.areaCount,caption:`Districts and market areas`,icon:s,accentColor:`blue`,badge:`AREAS`})]}),(0,C.jsx)(`div`,{className:`app-filter-bar`,children:(0,C.jsxs)(`div`,{style:{display:`flex`,gap:16,alignItems:`center`,flexWrap:`wrap`,width:`100%`},children:[(0,C.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,C.jsxs)(`label`,{className:`form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1`,style:{marginBottom:0},children:[(0,C.jsx)(a,{size:13}),` As On:`]}),(0,C.jsx)(`input`,{id:`filter-as-on`,type:`date`,className:`form-input text-sm`,style:{width:150},value:n,onChange:e=>E(e.target.value)})]}),(0,C.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,C.jsx)(`label`,{className:`form-label text-xs font-semibold uppercase tracking-wider text-muted`,style:{marginBottom:0},children:`Filter:`}),(0,C.jsxs)(`select`,{id:`filter-balance-type`,className:`form-select text-sm font-medium`,style:{width:210},value:O,onChange:e=>k(e.target.value),children:[(0,C.jsx)(`option`,{value:`DR`,children:`Parties With DR Balances`}),(0,C.jsx)(`option`,{value:`CR`,children:`Parties With CR Balances`}),(0,C.jsx)(`option`,{value:`ALL`,children:`All Parties (DR & CR)`})]})]}),(0,C.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,C.jsx)(`label`,{className:`form-label text-xs font-semibold uppercase tracking-wider text-muted`,style:{marginBottom:0},children:`Area:`}),(0,C.jsxs)(`select`,{id:`filter-area`,className:`form-select text-sm font-medium`,style:{width:190},value:A,onChange:e=>j(e.target.value),children:[(0,C.jsx)(`option`,{value:``,children:`All Areas`}),R.map(e=>(0,C.jsx)(`option`,{value:e,children:e},e))]})]}),V&&(0,C.jsxs)(`div`,{className:`flex items-center gap-2 text-muted text-xs ml-auto font-medium`,children:[(0,C.jsx)(`span`,{className:`spinner`,style:{width:14,height:14}}),(0,C.jsx)(`span`,{children:`Updating report...`})]})]})})]}),(0,C.jsxs)(`div`,{className:`printable-report report-paper`,id:`report-printable-area`,children:[(0,C.jsxs)(`div`,{className:`report-header-banner`,children:[(0,C.jsxs)(`div`,{className:`flex justify-between items-start`,children:[(0,C.jsxs)(`div`,{children:[(0,C.jsxs)(`div`,{style:{fontSize:16,fontWeight:800,color:`#0f172a`,letterSpacing:`0.02em`},children:[q,`, `,J]}),(0,C.jsx)(`div`,{style:{fontSize:18,fontWeight:700,color:`#1e293b`,marginTop:2},children:`Party Wise Balance Report`})]}),(0,C.jsxs)(`div`,{style:{textAlign:`right`,fontSize:11,color:`#64748b`},children:[(0,C.jsx)(`div`,{children:`Page# 1 of 1`}),(0,C.jsxs)(`div`,{children:[`Dated: `,T(t)]})]})]}),(0,C.jsxs)(`div`,{className:`flex justify-between items-center text-sm`,style:{marginTop:10,paddingTop:8,borderTop:`1px dashed #cbd5e1`,color:`#334155`,fontSize:12,fontWeight:600},children:[(0,C.jsxs)(`div`,{children:[(0,C.jsx)(`span`,{style:{color:`#64748b`},children:`As On: `}),(0,C.jsx)(`span`,{children:T(H.asOnDate)})]}),(0,C.jsxs)(`div`,{children:[(0,C.jsx)(`span`,{style:{color:`#64748b`},children:`Filter: `}),(0,C.jsx)(`span`,{children:H.filterLabel})]}),A&&(0,C.jsxs)(`div`,{children:[(0,C.jsx)(`span`,{style:{color:`#64748b`},children:`Area: `}),(0,C.jsx)(`span`,{style:{color:`var(--primary, #2563eb)`},children:A.toUpperCase()})]})]})]}),B?(0,C.jsxs)(`div`,{style:{textAlign:`center`,padding:`48px 0`},children:[(0,C.jsx)(`div`,{className:`spinner`,style:{margin:`auto`,width:28,height:28}}),(0,C.jsxs)(`p`,{className:`text-muted text-sm`,style:{marginTop:12},children:[`Calculating historical party balances as on `,T(n),`...`]})]}):U.length===0?(0,C.jsxs)(`div`,{style:{textAlign:`center`,padding:`48px 0`,color:`#64748b`},children:[(0,C.jsx)(`p`,{style:{fontSize:15,fontWeight:600},children:`No parties found matching the selected criteria.`}),(0,C.jsx)(`p`,{className:`text-xs`,style:{marginTop:4},children:`Try switching the filter to "All Parties" or selecting a different As On date.`})]}):(0,C.jsx)(`div`,{style:{overflowX:`auto`},children:(0,C.jsxs)(`table`,{className:`report-table`,children:[(0,C.jsx)(`thead`,{children:(0,C.jsxs)(`tr`,{children:[(0,C.jsx)(`th`,{style:{width:45,textAlign:`center`},children:`S#`}),(0,C.jsx)(`th`,{style:{width:80,textAlign:`center`},children:`CODE`}),(0,C.jsx)(`th`,{style:{width:130,textAlign:`right`},children:`CLOSING`}),(0,C.jsx)(`th`,{style:{textAlign:`left`,paddingLeft:16},children:`PARTY`}),(0,C.jsx)(`th`,{style:{width:60,textAlign:`center`},children:`TYPE`})]})}),(0,C.jsxs)(`tbody`,{children:[U.map(e=>(0,C.jsx)(D,{group:e},e.area)),(0,C.jsxs)(`tr`,{className:`grand-total-row`,children:[(0,C.jsx)(`td`,{colSpan:2,style:{textAlign:`left`,fontWeight:800},children:`GRAND TOTAL`}),(0,C.jsx)(`td`,{style:{textAlign:`right`,fontWeight:800},className:`tabular`,children:w(H.grandTotal)}),(0,C.jsxs)(`td`,{colSpan:2,style:{textAlign:`right`,fontSize:11,fontWeight:500,opacity:.85},children:[`Total `,H.totalCount,` Parties across `,H.areaCount,` Areas`]})]})]})]})})]})]})}function D({group:e}){return(0,C.jsxs)(C.Fragment,{children:[(0,C.jsx)(`tr`,{className:`area-header-row`,children:(0,C.jsx)(`td`,{colSpan:5,children:(0,C.jsxs)(`div`,{className:`flex items-center gap-6`,children:[(0,C.jsx)(`span`,{style:{color:`#2563eb`,fontWeight:800},children:`Area`}),(0,C.jsx)(`span`,{style:{fontWeight:800,textTransform:`uppercase`},children:e.area}),(0,C.jsxs)(`span`,{style:{fontSize:11,fontWeight:500,color:`#64748b`,marginLeft:8},children:[`(`,e.count,` `,e.count===1?`party`:`parties`,`)`]})]})})}),e.items.map(e=>(0,C.jsxs)(`tr`,{className:`hover:bg-slate-50 transition-colors`,children:[(0,C.jsx)(`td`,{style:{textAlign:`center`,color:`#64748b`,fontSize:12},children:e.seq}),(0,C.jsx)(`td`,{style:{textAlign:`center`,fontFamily:`monospace`,fontWeight:600,color:`#334155`},children:e.code||`0`}),(0,C.jsx)(`td`,{style:{textAlign:`right`,fontWeight:700,color:`#0f172a`},className:`tabular`,children:w(e.closing)}),(0,C.jsxs)(`td`,{style:{textAlign:`left`,paddingLeft:16},children:[(0,C.jsx)(`div`,{style:{fontWeight:600,color:`#0f172a`,textTransform:`uppercase`},children:e.customerName}),e.shopName&&(0,C.jsxs)(`div`,{style:{fontSize:11,color:`#64748b`},children:[e.shopName,` `,e.phone?`• ${e.phone}`:``]})]}),(0,C.jsx)(`td`,{style:{textAlign:`center`},children:(0,C.jsx)(`span`,{style:{display:`inline-block`,fontWeight:700,fontSize:11,padding:`1px 6px`,borderRadius:4,color:e.balanceType===`DR`?`#1e40af`:`#b91c1c`,background:e.balanceType===`DR`?`rgba(37, 99, 235, 0.08)`:`rgba(239, 68, 68, 0.08)`},children:e.balanceType})})]},e.id)),(0,C.jsxs)(`tr`,{className:`area-subtotal-row`,children:[(0,C.jsxs)(`td`,{colSpan:2,style:{textAlign:`left`,fontWeight:700},children:[`TOTAL Area `,e.area]}),(0,C.jsx)(`td`,{style:{textAlign:`right`,fontWeight:700},className:`tabular`,children:w(e.subtotal)}),(0,C.jsx)(`td`,{colSpan:2})]})]})}export{E as default};