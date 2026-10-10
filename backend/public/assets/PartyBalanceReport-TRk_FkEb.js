import{r as e}from"./rolldown-runtime-hePW80VL.js";import{l as t}from"./vendor-charts-DzI0KgKL.js";import{b as n,n as r}from"./vendor-query-DKZ_DrwU.js";import{r as i}from"./vendor-utils-U1zNY8Qv.js";import{G as a,I as o,L as s,P as c,f as l,h as u,i as d,k as f,v as p,x as m,y as h,z as g}from"./index-CHETZB9T.js";var _=e(t(),1),v=n();function y(e){return parseFloat(e||0).toLocaleString(`en-PK`,{minimumFractionDigits:0,maximumFractionDigits:2})}function b(e){if(!e)return``;let t=new Date(e);return`${String(t.getDate()).padStart(2,`0`)}/${String(t.getMonth()+1).padStart(2,`0`)}/${t.getFullYear()}`}function x(){let{user:e}=f(),t=new Date().toISOString().slice(0,10),[n,x]=(0,_.useState)(t),[C,w]=(0,_.useState)(`DR`),[T,E]=(0,_.useState)(``),[D,O]=(0,_.useState)(!1),[k,A]=(0,_.useState)(!1),{data:j}=r({queryKey:[`customer-areas`],queryFn:()=>o.areas().then(e=>e.data?.data||[])}),{data:M}=r({queryKey:[`cities-all`],queryFn:()=>c.list({limit:100}).then(e=>(e.data?.data||[]).map(e=>e.cityName))}),N=Array.from(new Set([...j||[],...M||[]])).filter(Boolean).sort(),{data:P,isLoading:F,isFetching:I}=r({queryKey:[`party-balance-report`,n,C,T],queryFn:()=>a.partyBalance({asOn:n,filter:C,area:T}).then(e=>e.data?.data)}),L=P||{asOnDate:n,filter:C,filterLabel:`Parties With DR Balances`,areaGroups:[],grandTotal:0,totalCount:0,areaCount:0},R=L.areaGroups||[];async function z(){try{O(!0);let e=await g.partyBalancePDF({asOn:n,filter:C,area:T});s(e,`PartyBalance-${n}.pdf`),i.success(`PDF report downloaded.`)}catch{i.error(`Failed to export PDF.`)}finally{O(!1)}}async function B(){try{A(!0);let e=await g.partyBalanceExcel({asOn:n,filter:C,area:T});s(e,`PartyBalance-${n}.xlsx`),i.success(`Excel report downloaded.`)}catch{i.error(`Failed to export Excel.`)}finally{A(!1)}}function V(){window.print()}let H=(e?.businessName||`RAHMAT MEDICAL WHOLESALE`).toUpperCase(),U=(e?.city||`BHIRYA CITY`).toUpperCase();return(0,v.jsxs)(`div`,{className:`party-balance-page`,children:[(0,v.jsx)(`style`,{children:`
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
      `}),(0,v.jsxs)(`div`,{className:`no-print`,children:[(0,v.jsxs)(`div`,{className:`page-header flex justify-between items-center flex-wrap gap-12`,children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`h2`,{className:`page-title`,children:`Party Wise Balance Report`}),(0,v.jsx)(`p`,{className:`text-muted text-sm`,children:`Customer balances grouped by area territory with running subtotals`})]}),(0,v.jsxs)(`div`,{className:`flex gap-8 flex-wrap`,children:[(0,v.jsxs)(`button`,{id:`print-report-btn`,className:`btn btn-outline`,onClick:V,disabled:F||R.length===0,children:[(0,v.jsx)(l,{size:15}),` Print`]}),(0,v.jsxs)(`button`,{id:`export-pdf-btn`,className:`btn btn-outline`,onClick:z,disabled:D||F||R.length===0,children:[(0,v.jsx)(h,{size:15}),` `,D?`Exporting...`:`PDF`]}),(0,v.jsxs)(`button`,{id:`export-excel-btn`,className:`btn btn-outline`,onClick:B,disabled:k||F||R.length===0,children:[(0,v.jsx)(p,{size:15}),` `,k?`Exporting...`:`Excel`]})]})]}),(0,v.jsx)(`div`,{className:`card`,style:{padding:`14px 18px`,marginTop:14},children:(0,v.jsxs)(`div`,{className:`flex gap-16 items-center flex-wrap`,children:[(0,v.jsxs)(`div`,{className:`flex items-center gap-8`,children:[(0,v.jsx)(`label`,{className:`form-label`,style:{marginBottom:0,fontWeight:600,fontSize:13},children:`As On:`}),(0,v.jsx)(`input`,{id:`filter-as-on`,type:`date`,className:`form-input`,style:{width:145,padding:`6px 10px`},value:n,onChange:e=>x(e.target.value)})]}),(0,v.jsxs)(`div`,{className:`flex items-center gap-8`,children:[(0,v.jsx)(`label`,{className:`form-label`,style:{marginBottom:0,fontWeight:600,fontSize:13},children:`Filter:`}),(0,v.jsxs)(`select`,{id:`filter-balance-type`,className:`form-input`,style:{width:195,padding:`6px 10px`},value:C,onChange:e=>w(e.target.value),children:[(0,v.jsx)(`option`,{value:`DR`,children:`Parties With DR Balances`}),(0,v.jsx)(`option`,{value:`CR`,children:`Parties With CR Balances`}),(0,v.jsx)(`option`,{value:`ALL`,children:`All Parties (DR & CR)`})]})]}),(0,v.jsxs)(`div`,{className:`flex items-center gap-8`,children:[(0,v.jsx)(`label`,{className:`form-label`,style:{marginBottom:0,fontWeight:600,fontSize:13},children:`Area:`}),(0,v.jsxs)(`select`,{id:`filter-area`,className:`form-input`,style:{width:175,padding:`6px 10px`},value:T,onChange:e=>E(e.target.value),children:[(0,v.jsx)(`option`,{value:``,children:`All Areas`}),N.map(e=>(0,v.jsx)(`option`,{value:e,children:e},e))]})]}),I&&(0,v.jsxs)(`div`,{className:`flex items-center gap-6 text-muted text-sm ml-auto`,children:[(0,v.jsx)(`span`,{className:`spinner`,style:{width:14,height:14}}),(0,v.jsx)(`span`,{children:`Updating report...`})]})]})}),(0,v.jsxs)(`div`,{className:`grid-3`,style:{marginTop:14,gap:14},children:[(0,v.jsxs)(`div`,{className:`card`,style:{padding:`14px 18px`},children:[(0,v.jsxs)(`div`,{className:`text-muted text-xs font-medium uppercase tracking-wider flex items-center gap-6`,children:[(0,v.jsx)(m,{size:14,className:`text-primary`}),` Total Balance (`,C,`)`]}),(0,v.jsxs)(`div`,{className:`tabular`,style:{fontSize:22,fontWeight:700,marginTop:4,color:`var(--text-primary)`},children:[`Rs `,y(L.grandTotal)]})]}),(0,v.jsxs)(`div`,{className:`card`,style:{padding:`14px 18px`},children:[(0,v.jsxs)(`div`,{className:`text-muted text-xs font-medium uppercase tracking-wider flex items-center gap-6`,children:[(0,v.jsx)(d,{size:14,className:`text-primary`}),` Parties Listed`]}),(0,v.jsx)(`div`,{className:`tabular`,style:{fontSize:22,fontWeight:700,marginTop:4,color:`var(--text-primary)`},children:L.totalCount})]}),(0,v.jsxs)(`div`,{className:`card`,style:{padding:`14px 18px`},children:[(0,v.jsxs)(`div`,{className:`text-muted text-xs font-medium uppercase tracking-wider flex items-center gap-6`,children:[(0,v.jsx)(u,{size:14,className:`text-primary`}),` Active Areas`]}),(0,v.jsx)(`div`,{className:`tabular`,style:{fontSize:22,fontWeight:700,marginTop:4,color:`var(--text-primary)`},children:L.areaCount})]})]})]}),(0,v.jsxs)(`div`,{className:`printable-report report-paper`,id:`report-printable-area`,children:[(0,v.jsxs)(`div`,{className:`report-header-banner`,children:[(0,v.jsxs)(`div`,{className:`flex justify-between items-start`,children:[(0,v.jsxs)(`div`,{children:[(0,v.jsxs)(`div`,{style:{fontSize:16,fontWeight:800,color:`#0f172a`,letterSpacing:`0.02em`},children:[H,`, `,U]}),(0,v.jsx)(`div`,{style:{fontSize:18,fontWeight:700,color:`#1e293b`,marginTop:2},children:`Party Wise Balance Report`})]}),(0,v.jsxs)(`div`,{style:{textAlign:`right`,fontSize:11,color:`#64748b`},children:[(0,v.jsx)(`div`,{children:`Page# 1 of 1`}),(0,v.jsxs)(`div`,{children:[`Dated: `,b(t)]})]})]}),(0,v.jsxs)(`div`,{className:`flex justify-between items-center text-sm`,style:{marginTop:10,paddingTop:8,borderTop:`1px dashed #cbd5e1`,color:`#334155`,fontSize:12,fontWeight:600},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`span`,{style:{color:`#64748b`},children:`As On: `}),(0,v.jsx)(`span`,{children:b(L.asOnDate)})]}),(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`span`,{style:{color:`#64748b`},children:`Filter: `}),(0,v.jsx)(`span`,{children:L.filterLabel})]}),T&&(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`span`,{style:{color:`#64748b`},children:`Area: `}),(0,v.jsx)(`span`,{style:{color:`var(--primary, #2563eb)`},children:T.toUpperCase()})]})]})]}),F?(0,v.jsxs)(`div`,{style:{textAlign:`center`,padding:`48px 0`},children:[(0,v.jsx)(`div`,{className:`spinner`,style:{margin:`auto`,width:28,height:28}}),(0,v.jsxs)(`p`,{className:`text-muted text-sm`,style:{marginTop:12},children:[`Calculating historical party balances as on `,b(n),`...`]})]}):R.length===0?(0,v.jsxs)(`div`,{style:{textAlign:`center`,padding:`48px 0`,color:`#64748b`},children:[(0,v.jsx)(`p`,{style:{fontSize:15,fontWeight:600},children:`No parties found matching the selected criteria.`}),(0,v.jsx)(`p`,{className:`text-xs`,style:{marginTop:4},children:`Try switching the filter to "All Parties" or selecting a different As On date.`})]}):(0,v.jsx)(`div`,{style:{overflowX:`auto`},children:(0,v.jsxs)(`table`,{className:`report-table`,children:[(0,v.jsx)(`thead`,{children:(0,v.jsxs)(`tr`,{children:[(0,v.jsx)(`th`,{style:{width:45,textAlign:`center`},children:`S#`}),(0,v.jsx)(`th`,{style:{width:80,textAlign:`center`},children:`CODE`}),(0,v.jsx)(`th`,{style:{width:130,textAlign:`right`},children:`CLOSING`}),(0,v.jsx)(`th`,{style:{textAlign:`left`,paddingLeft:16},children:`PARTY`}),(0,v.jsx)(`th`,{style:{width:60,textAlign:`center`},children:`TYPE`})]})}),(0,v.jsxs)(`tbody`,{children:[R.map(e=>(0,v.jsx)(S,{group:e},e.area)),(0,v.jsxs)(`tr`,{className:`grand-total-row`,children:[(0,v.jsx)(`td`,{colSpan:2,style:{textAlign:`left`,fontWeight:800},children:`GRAND TOTAL`}),(0,v.jsx)(`td`,{style:{textAlign:`right`,fontWeight:800},className:`tabular`,children:y(L.grandTotal)}),(0,v.jsxs)(`td`,{colSpan:2,style:{textAlign:`right`,fontSize:11,fontWeight:500,opacity:.85},children:[`Total `,L.totalCount,` Parties across `,L.areaCount,` Areas`]})]})]})]})})]})]})}function S({group:e}){return(0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)(`tr`,{className:`area-header-row`,children:(0,v.jsx)(`td`,{colSpan:5,children:(0,v.jsxs)(`div`,{className:`flex items-center gap-6`,children:[(0,v.jsx)(`span`,{style:{color:`#2563eb`,fontWeight:800},children:`Area`}),(0,v.jsx)(`span`,{style:{fontWeight:800,textTransform:`uppercase`},children:e.area}),(0,v.jsxs)(`span`,{style:{fontSize:11,fontWeight:500,color:`#64748b`,marginLeft:8},children:[`(`,e.count,` `,e.count===1?`party`:`parties`,`)`]})]})})}),e.items.map(e=>(0,v.jsxs)(`tr`,{className:`hover:bg-slate-50 transition-colors`,children:[(0,v.jsx)(`td`,{style:{textAlign:`center`,color:`#64748b`,fontSize:12},children:e.seq}),(0,v.jsx)(`td`,{style:{textAlign:`center`,fontFamily:`monospace`,fontWeight:600,color:`#334155`},children:e.code||`0`}),(0,v.jsx)(`td`,{style:{textAlign:`right`,fontWeight:700,color:`#0f172a`},className:`tabular`,children:y(e.closing)}),(0,v.jsxs)(`td`,{style:{textAlign:`left`,paddingLeft:16},children:[(0,v.jsx)(`div`,{style:{fontWeight:600,color:`#0f172a`,textTransform:`uppercase`},children:e.customerName}),e.shopName&&(0,v.jsxs)(`div`,{style:{fontSize:11,color:`#64748b`},children:[e.shopName,` `,e.phone?`• ${e.phone}`:``]})]}),(0,v.jsx)(`td`,{style:{textAlign:`center`},children:(0,v.jsx)(`span`,{style:{display:`inline-block`,fontWeight:700,fontSize:11,padding:`1px 6px`,borderRadius:4,color:e.balanceType===`DR`?`#1e40af`:`#b91c1c`,background:e.balanceType===`DR`?`rgba(37, 99, 235, 0.08)`:`rgba(239, 68, 68, 0.08)`},children:e.balanceType})})]},e.id)),(0,v.jsxs)(`tr`,{className:`area-subtotal-row`,children:[(0,v.jsxs)(`td`,{colSpan:2,style:{textAlign:`left`,fontWeight:700},children:[`TOTAL Area `,e.area]}),(0,v.jsx)(`td`,{style:{textAlign:`right`,fontWeight:700},className:`tabular`,children:y(e.subtotal)}),(0,v.jsx)(`td`,{colSpan:2})]})]})}export{x as default};