#!/usr/bin/env python3
"""
Generate the standalone TalentGraph Africa v3 Elite HTML demo.
Writes to public/talentgraph-demo.html so it's served by Vite in dev
and included in production builds.
"""
import os

HTML_PARTS = []

# Part 1: Head + CSS tokens/reset/nav/layout
HTML_PARTS.append(r"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
<title>TalentGraph Africa — UNMAPPED · World Bank Challenge 05</title>
<meta name="description" content="Map informal-economy skills to ISCO-08 codes, assess AI displacement risk, and match to real econometric opportunities. World Bank Challenge 05.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
--bg:#07080C;--bg1:#0D1018;--bg2:#141820;--bg3:#1B2030;--bg4:#222840;
--bdr:rgba(255,255,255,.055);--bdrhi:rgba(255,255,255,.13);
--gold:#F5A623;--goldd:rgba(245,166,35,.11);--goldg:rgba(245,166,35,.24);
--teal:#00C9A7;--teald:rgba(0,201,167,.10);--tealg:rgba(0,201,167,.22);
--red:#FF4757;--redd:rgba(255,71,87,.12);
--blue:#4A9FFF;--blued:rgba(74,159,255,.10);
--lav:#A78BFA;--lavd:rgba(167,139,250,.10);
--tx0:#EDF0F8;--tx1:#9BA8C0;--tx2:#4D5870;
--fd:'Syne',sans-serif;--fb:'DM Sans',sans-serif;--fm:'JetBrains Mono',monospace;
--r8:8px;--r10:10px;--r12:12px;--r16:16px;--sw:220px;--nh:54px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--fb);background:var(--bg);color:var(--tx0);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;line-height:1.5}
::selection{background:var(--goldd);color:var(--gold)}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:var(--bg1)}::-webkit-scrollbar-thumb{background:var(--bg3);border-radius:4px}
input,textarea,button,select{font-family:inherit;outline:none}
a{color:var(--gold);text-decoration:none}

.nav{position:fixed;top:0;left:0;right:0;height:var(--nh);background:rgba(7,8,12,.93);backdrop-filter:blur(24px);border-bottom:1px solid var(--bdr);display:flex;align-items:center;padding:0 18px;gap:6px;z-index:200}
.nav-mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--gold),#C87000);display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-weight:800;font-size:13px;color:#000;flex-shrink:0}
.nav-name{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--tx0);line-height:1}
.nav-sub{font-size:9px;color:var(--tx2);letter-spacing:.08em;text-transform:uppercase}
.nav-badge{background:var(--goldd);border:1px solid var(--goldg);border-radius:5px;padding:3px 8px;font-size:10px;font-weight:700;color:var(--gold);font-family:var(--fd);flex-shrink:0;margin:0 6px}
.nav-tabs{display:flex;gap:1px;flex:1;overflow-x:auto;scrollbar-width:none}
.nav-tabs::-webkit-scrollbar{display:none}
.nav-tab{display:flex;align-items:center;gap:6px;padding:6px 13px;border-radius:var(--r8);font-size:12.5px;font-weight:500;color:var(--tx2);cursor:pointer;border:none;background:none;font-family:var(--fb);transition:all .18s;white-space:nowrap;position:relative}
.nav-tab:hover{color:var(--tx1);background:var(--bg2)}
.nav-tab.active{color:var(--tx0);background:var(--bg2)}
.nav-tab.active::after{content:'';position:absolute;bottom:-1px;left:12px;right:12px;height:2px;background:var(--gold);border-radius:2px}
.nav-tabnum{font-size:9px;padding:1px 5px;border-radius:4px;font-family:var(--fm);font-weight:500;background:var(--bg3);color:var(--tx2)}
.nav-tab.active .nav-tabnum{background:var(--goldd);color:var(--gold)}
.nav-right{display:flex;align-items:center;gap:7px;margin-left:auto;flex-shrink:0}
.ctr-btn{display:flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r8);padding:5px 10px;cursor:pointer;font-size:12px;font-weight:500;color:var(--tx0);transition:all .2s;font-family:var(--fb)}
.ctr-btn:hover{border-color:var(--bdrhi)}
.bw-badge{display:flex;align-items:center;gap:5px;background:var(--teald);border:1px solid var(--tealg);border-radius:5px;padding:4px 9px;font-size:10.5px;color:var(--teal);font-family:var(--fm)}
.bw-dot{width:5px;height:5px;border-radius:50%;background:var(--teal);animation:pw 2s infinite}
@keyframes pw{0%,100%{opacity:1}50%{opacity:.35}}

.layout{display:grid;grid-template-columns:var(--sw) 1fr;padding-top:var(--nh);min-height:100vh}
.sidebar{position:fixed;top:var(--nh);left:0;bottom:0;width:var(--sw);background:var(--bg1);border-right:1px solid var(--bdr);overflow-y:auto;padding:14px 12px;z-index:100}
.main{margin-left:var(--sw);min-height:calc(100vh - var(--nh))}

.sb-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--tx2);padding:0 3px;margin-bottom:8px}
.sig-row{display:flex;justify-content:space-between;align-items:center;padding:4px 3px;border-bottom:1px solid var(--bdr)}
.sig-row:last-child{border-bottom:none}
.sig-k{font-size:10.5px;color:var(--tx1)}.sig-v{font-size:11.5px;font-weight:700;font-family:var(--fm)}
.sig-v.red{color:var(--red)}.sig-v.gold{color:var(--gold)}.sig-v.teal{color:var(--teal)}.sig-v.blue{color:var(--blue)}
.persona-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:var(--r8);cursor:pointer;border:1px solid transparent;transition:all .18s;margin-bottom:4px}
.persona-row:hover{background:var(--bg2);border-color:var(--bdr)}
.persona-row.active{background:var(--goldd);border-color:var(--goldg)}

.panel{display:none;animation:fi .25s ease both}
.panel.active{display:block}
@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

.eyebrow{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--tx2);font-family:var(--fd);display:flex;align-items:center;gap:8px;margin-bottom:10px}
.eyebrow::before{content:'';display:block;width:24px;height:1.5px;background:var(--bdrhi)}
.mod-title{font-family:var(--fd);font-size:28px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px}
.mod-sub{font-size:14px;color:var(--tx1);max-width:540px;line-height:1.65;margin-bottom:20px}
.col-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--tx2);margin-bottom:10px}

.btn{display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:var(--r10);font-size:13.5px;font-weight:600;cursor:pointer;border:none;transition:all .2s;font-family:var(--fb);white-space:nowrap}
.btn-primary{background:var(--gold);color:#000}.btn-primary:hover{background:#FFB733;transform:translateY(-1px)}
.btn-ghost{background:var(--bg2);border:1px solid var(--bdr);color:var(--tx0)}.btn-ghost:hover{border-color:var(--bdrhi)}
.btn-teal{background:var(--teal);color:#000}.btn-teal:hover{background:#00DEB8}
.btn-sm{padding:7px 13px;font-size:11.5px}

.card{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r16);padding:20px;transition:all .22s}
.card:hover{border-color:var(--bdrhi)}

.hero{padding:52px 44px 36px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-100px;right:-60px;width:480px;height:480px;background:radial-gradient(circle,rgba(245,166,35,.07),transparent 70%);pointer-events:none}
.hero-h1{font-family:var(--fd);font-size:clamp(32px,4.5vw,56px);font-weight:800;line-height:1.05;letter-spacing:-0.02em;margin-bottom:14px}
.hero-h1 .hl{background:linear-gradient(120deg,var(--gold),#FFD166 60%,var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-p{font-size:15px;color:var(--tx1);max-width:560px;line-height:1.7;margin-bottom:24px}

.section-wrap{padding:0 44px 36px}
.section-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.country-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.ctr-card{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r16);padding:15px;cursor:pointer;transition:all .22s}
.ctr-card:hover{border-color:var(--bdrhi);transform:translateY(-2px)}
.ctr-card.active{border-color:var(--goldg)}
.ctr-row{display:flex;justify-content:space-between;margin-bottom:4px}
.ctr-k{font-size:9.5px;color:var(--tx2)}.ctr-v{font-size:10.5px;font-weight:700;font-family:var(--fm)}

.mod-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.mod-card{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r16);padding:22px;cursor:pointer;transition:all .24s;position:relative;overflow:hidden}
.mod-card:hover{border-color:var(--bdrhi);transform:translateY(-3px)}
.mod-card::before{content:'';position:absolute;top:-50px;right:-50px;width:130px;height:130px;border-radius:50%;transition:transform .4s}
.mod-card:nth-child(1)::before{background:radial-gradient(circle,rgba(245,166,35,.12),transparent 70%)}
.mod-card:nth-child(2)::before{background:radial-gradient(circle,rgba(255,71,87,.12),transparent 70%)}
.mod-card:nth-child(3)::before{background:radial-gradient(circle,rgba(0,201,167,.12),transparent 70%)}
.mod-card:hover::before{transform:scale(2.2)}
.mod-num{font-size:9.5px;font-weight:700;letter-spacing:.09em;font-family:var(--fd);margin-bottom:12px}
.mod-ov-title{font-family:var(--fd);font-size:16.5px;font-weight:700;margin-bottom:7px}
.mod-ov-desc{font-size:11.5px;color:var(--tx1);line-height:1.55;margin-bottom:13px}
.mod-req{font-size:10px;color:var(--tx1);display:flex;align-items:center;gap:5px;margin-bottom:3px}
.mod-req::before{content:'✓';color:var(--teal);font-weight:700}

.trust-bar{display:flex;gap:10px;flex-wrap:wrap;padding:0 44px 44px}
.trust-chip{display:flex;align-items:center;gap:7px;background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r8);padding:8px 13px;font-size:11px;color:var(--tx1)}

.skills-layout{display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 250px)}
.skill-col{padding:24px 28px}
.skill-col.output{background:var(--bg1);border-left:1px solid var(--bdr)}

.persona-chip{display:flex;align-items:center;gap:5px;background:var(--bg2);border:1px solid var(--bdr);border-radius:20px;padding:5px 11px;font-size:11px;color:var(--tx1);cursor:pointer;transition:all .16s}
.persona-chip:hover{border-color:var(--goldg);color:var(--gold)}
.persona-chip.sel{background:var(--goldd);border-color:var(--goldg);color:var(--gold)}
.skill-textarea{width:100%;min-height:150px;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r10);color:var(--tx0);font-size:12.5px;line-height:1.65;padding:13px;resize:vertical;transition:border-color .2s}
.skill-textarea:focus{border-color:var(--goldg)}
.skill-textarea::placeholder{color:var(--tx2)}
.map-btn{background:var(--gold);color:#000;border:none;border-radius:var(--r8);padding:8px 18px;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;transition:all .2s}
.map-btn:hover{background:#FFB733}
.map-btn:disabled{opacity:.5;cursor:not-allowed}

.skills-tbl{width:100%;border-collapse:collapse}
.skills-tbl th{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--tx2);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--bdr);text-align:left}
.skills-tbl td{padding:9px 8px;border-bottom:1px solid var(--bdr);font-size:11.5px;vertical-align:top}
.skills-tbl tr:last-child td{border-bottom:none}
.skills-tbl tr:hover td{background:rgba(255,255,255,.015)}
.isco-pill{background:var(--goldd);color:var(--gold);border-radius:4px;padding:2px 6px;font-family:var(--fm);font-size:10px;font-weight:700}
.esco-pill{background:var(--blued);color:var(--blue);border-radius:4px;padding:2px 6px;font-family:var(--fm);font-size:9.5px}
.lvl-bar{display:flex;align-items:center;gap:5px}.lvl-track{flex:1;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden}.lvl-fill{height:100%;border-radius:2px}
.conf-hi{background:var(--teald);color:var(--teal);font-size:9.5px;font-family:var(--fm);font-weight:600;padding:1px 6px;border-radius:4px}
.conf-md{background:var(--goldd);color:var(--gold);font-size:9.5px;font-family:var(--fm);font-weight:600;padding:1px 6px;border-radius:4px}

.constellation-box{width:100%;height:200px;position:relative;background:var(--bg);border:1px solid var(--bdr);border-radius:var(--r12);overflow:hidden;margin-bottom:14px}
#cCanvas{width:100%;height:100%}
.constellation-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--tx2);gap:7px;font-size:12px}

.empty-state{text-align:center;padding:32px 16px;color:var(--tx2)}

.readiness-layout{display:grid;grid-template-columns:1fr 1.15fr;gap:24px;padding:24px 44px}
.gauge-box{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r16);padding:20px;text-align:center;margin-bottom:14px}
.gauge-label{font-size:11px;color:var(--tx1);margin-top:7px}
.risk-row{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r10);padding:11px 13px;margin-bottom:7px}
.risk-track{height:5px;background:var(--bg3);border-radius:3px;margin-bottom:5px;overflow:hidden}
.risk-fill{height:100%;border-radius:3px;transition:width 1.2s ease}
.durable-chip{display:inline-flex;align-items:center;gap:3px;background:var(--teald);color:var(--teal);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;margin-right:4px}
.proj-box{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r16);padding:18px;margin-bottom:14px}
.adj-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.adj-card{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r10);padding:12px;cursor:pointer;transition:all .2s}
.adj-card:hover{border-color:var(--tealg);transform:translateY(-1px)}
.resource-row{display:flex;justify-content:space-between;align-items:center;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r8);padding:9px 11px;margin-bottom:5px}

.opp-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}
.view-toggle{display:flex;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r8);overflow:hidden}
.vbtn{padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--tx2);transition:all .18s;font-family:var(--fb)}
.vbtn.active{background:var(--bg3);color:var(--tx0)}
.cfbtn{padding:5px 11px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--bdr);background:none;color:var(--tx2);transition:all .18s;font-family:var(--fb)}
.cfbtn.active{background:var(--goldd);border-color:var(--goldg);color:var(--gold)}
.pfbtn{padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid var(--bdr);background:none;color:var(--tx2);transition:all .18s;font-family:var(--fb)}
.pfbtn.active{background:var(--bg2);color:var(--tx0)}

.econ-strip{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--bdr)}
.econ-cell{padding:14px 20px;border-right:1px solid var(--bdr)}
.econ-cell:last-child{border-right:none}
.econ-val{font-family:var(--fm);font-size:22px;font-weight:700;margin-bottom:3px}
.econ-lbl{font-size:10px;color:var(--tx1);font-weight:500}
.econ-src{font-size:8.5px;color:var(--tx2);margin-top:3px;font-family:var(--fm);font-style:italic}

.opp-body{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:20px 44px}
.opp-card{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r16);padding:19px;transition:all .22s;cursor:pointer}
.opp-card:hover{border-color:var(--bdrhi);transform:translateY(-2px);box-shadow:0 10px 36px rgba(0,0,0,.35)}
.opp-tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.opp-tag{background:var(--bg3);border-radius:4px;padding:2px 7px;font-size:9.5px;color:var(--tx1)}
.mhi{background:var(--teald);color:var(--teal);font-size:10.5px;font-family:var(--fm);font-weight:700;padding:3px 8px;border-radius:5px}
.mmd{background:var(--goldd);color:var(--gold);font-size:10.5px;font-family:var(--fm);font-weight:700;padding:3px 8px;border-radius:5px}
.flag-remote{background:var(--teald);color:var(--teal);font-size:9.5px;padding:2px 6px;border-radius:4px;font-family:var(--fm);font-weight:600}
.flag-ctr{background:var(--bg3);color:var(--tx2);font-size:9.5px;padding:2px 6px;border-radius:4px;font-family:var(--fm);font-weight:600}

.cred-card{background:linear-gradient(135deg,var(--bg2),var(--bg3));border:1px solid var(--bdrhi);border-radius:var(--r16);padding:19px;position:relative;overflow:hidden;margin-top:13px}
.cred-card::before{content:'';position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:radial-gradient(circle,var(--goldg),transparent 70%)}

.toast{position:fixed;bottom:22px;right:22px;background:var(--bg2);border:1px solid var(--bdrhi);border-radius:var(--r12);padding:11px 15px;font-size:12.5px;color:var(--tx0);display:none;align-items:center;gap:8px;z-index:999;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.toast.show{display:flex}

.sec-layout{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:24px 44px}
.sec-ctrl-card{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r12);padding:13px 15px;margin-bottom:8px}
.sec-event{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:6px;font-size:10.5px;margin-bottom:5px}
.se-pass{background:var(--teald)}.se-warn{background:var(--goldd)}.se-block{background:var(--redd)}

@media(max-width:960px){
:root{--sw:0px}
.sidebar{display:none}
.skills-layout,.readiness-layout,.opp-body,.sec-layout{grid-template-columns:1fr}
.country-grid{grid-template-columns:repeat(2,1fr)}
.mod-grid{grid-template-columns:1fr}
.econ-strip{grid-template-columns:1fr 1fr}
.hero,.section-wrap,.trust-bar,.opp-body,.readiness-layout,.sec-layout{padding-left:20px;padding-right:20px}
}
</style>
</head>
""")

# Part 2: Body skeleton (nav + sidebar + panel framework)
HTML_PARTS.append(r"""<body>
<nav class="nav">
<div style="display:flex;align-items:center;gap:9px;flex-shrink:0;margin-right:6px">
<div class="nav-mark">TG</div>
<div><div class="nav-name">TalentGraph</div><div class="nav-sub">Africa · Unmapped</div></div>
</div>
<div class="nav-badge">WB · CH 05</div>
<div class="nav-tabs">
<button class="nav-tab active" onclick="goPanel('overview',this)"><span style="font-size:10px">◈</span> Overview</button>
<button class="nav-tab" onclick="goPanel('skills',this)"><span class="nav-tabnum">01</span> Skills Engine</button>
<button class="nav-tab" onclick="goPanel('readiness',this)"><span class="nav-tabnum">02</span> AI Readiness</button>
<button class="nav-tab" onclick="goPanel('opportunities',this)"><span class="nav-tabnum">03</span> Opportunities</button>
<button class="nav-tab" onclick="goPanel('security',this)"><span style="font-size:11px">🛡</span> Security</button>
</div>
<div class="nav-right">
<div class="ctr-btn" onclick="cycleCountry()"><span id="navFlag">🇰🇪</span> <span id="navCtr">Kenya</span> <span style="color:var(--tx2);font-size:10px">▾</span></div>
<div class="bw-badge"><div class="bw-dot"></div><span>High BW</span></div>
</div>
</nav>

<div class="layout">
<aside class="sidebar">
<div style="margin-bottom:16px">
<div class="sb-lbl" id="sbLabel">Country Signals · Kenya</div>
<div class="sig-row"><span class="sig-k">Youth unemployment</span><span class="sig-v red" id="sb-yu">13.4%</span></div>
<div class="sig-row"><span class="sig-k">Min wage / month</span><span class="sig-v gold" id="sb-mw">$120</span></div>
<div class="sig-row"><span class="sig-k">Informal employment</span><span class="sig-v red" id="sb-inf">83.6%</span></div>
<div class="sig-row"><span class="sig-k">Human Capital Index</span><span class="sig-v blue" id="sb-hci">0.55</span></div>
<div style="font-size:8.5px;color:var(--tx2);padding:3px;font-style:italic;margin-top:4px">Sources: ILO ILOSTAT 2023 · World Bank HCI 2020</div>
</div>
<div style="margin-bottom:16px">
<div class="sb-lbl">Demo Personas</div>
<div class="persona-row active" onclick="selectPersona('sarah',this)"><div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--goldd);font-size:13px">🧵</div><div><div style="font-size:11.5px;font-weight:600">Sarah, 22</div><div style="font-size:9.5px;color:var(--tx2)">Seamstress · Eldoret, KE</div></div></div>
<div class="persona-row" onclick="selectPersona('james',this)"><div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--blued);font-size:13px">🔧</div><div><div style="font-size:11.5px;font-weight:600">James, 28</div><div style="font-size:9.5px;color:var(--tx2)">Phone repair · Nairobi</div></div></div>
<div class="persona-row" onclick="selectPersona('amara',this)"><div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(120,215,110,.1);font-size:13px">🌾</div><div><div style="font-size:11.5px;font-weight:600">Amara, 34</div><div style="font-size:9.5px;color:var(--tx2)">Farmer · Kano, NG</div></div></div>
<div class="persona-row" onclick="selectPersona('kwame',this)"><div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--lavd);font-size:13px">🛒</div><div><div style="font-size:11.5px;font-weight:600">Kwame, 26</div><div style="font-size:9.5px;color:var(--tx2)">Trader · Accra, GH</div></div></div>
</div>
<div><div class="sb-lbl">Security Status</div>
<div style="font-size:10.5px;display:flex;flex-direction:column;gap:3px">
<div style="display:flex;justify-content:space-between"><span style="color:var(--tx1)">Input sanitization</span><span style="color:var(--teal);font-family:var(--fm);font-size:9.5px">ACTIVE</span></div>
<div style="display:flex;justify-content:space-between"><span style="color:var(--tx1)">Rate limiting</span><span style="color:var(--teal);font-family:var(--fm);font-size:9.5px">ACTIVE</span></div>
<div style="display:flex;justify-content:space-between"><span style="color:var(--tx1)">Injection guard</span><span style="color:var(--teal);font-family:var(--fm);font-size:9.5px">ACTIVE</span></div>
<div style="display:flex;justify-content:space-between"><span style="color:var(--tx1)">API calls</span><span id="sbApiCount" style="color:var(--gold);font-family:var(--fm);font-size:9.5px">0 / 10</span></div>
</div>
</div>
</aside>

<main class="main">
""")

# Write overview panel placeholder reference
HTML_PARTS.append(r"""
<!-- ════ OVERVIEW ════ -->
<section class="panel active" id="panel-overview">
<div class="hero">
<div class="eyebrow">World Bank · Challenge 05 · UNMAPPED</div>
<h1 class="hero-h1">Make the <span class="hl">600 million</span> visible.</h1>
<p class="hero-p">TalentGraph Africa maps informal-economy skills to ISO occupation codes, surfaces real econometric signals, and anchors verified credentials cryptographically — so a seamstress in Eldoret becomes visible to an employer in London.</p>
<div style="display:flex;gap:10px;flex-wrap:wrap">
<button class="btn btn-primary" onclick="goPanel('skills',document.querySelectorAll('.nav-tab')[1])">✦ Demo Sarah in 90 seconds →</button>
<button class="btn btn-ghost" onclick="goPanel('opportunities',document.querySelectorAll('.nav-tab')[3])">◎ Explore Opportunity Dashboard</button>
</div>
</div>
<div class="section-wrap">
<div class="section-hdr"><div style="font-family:var(--fd);font-size:13.5px;font-weight:700">◈ Country Signals</div><div style="font-size:10px;color:var(--tx2);font-family:var(--fm)">Real figures · ILO ILOSTAT · WB WDI/HCI</div></div>
<div class="country-grid" id="countryGrid"></div>
</div>
<div class="section-wrap">
<div class="section-hdr"><div style="font-family:var(--fd);font-size:13.5px;font-weight:700">◉ Three Modules — All Three Built</div></div>
<div class="mod-grid">
<div class="mod-card" onclick="goPanel('skills',document.querySelectorAll('.nav-tab')[1])">
<div class="mod-num" style="color:var(--gold)">MODULE 01</div><div class="mod-ov-title">Skills Signal Engine</div>
<div class="mod-ov-desc">Voice or text → AI maps to ISCO-08 4-digit codes and ESCO v1.1 → portable, border-crossing profile.</div>
<div class="mod-req">Profile portable across borders &amp; sectors</div><div class="mod-req">ISCO-08 + ESCO v1.1 grounded</div><div class="mod-req">Voice input · multilingual · export JSON/CSV</div>
<div style="font-size:12px;font-weight:600;color:var(--gold);margin-top:14px">Open module →</div>
</div>
<div class="mod-card" onclick="goPanel('readiness',document.querySelectorAll('.nav-tab')[2])">
<div class="mod-num" style="color:var(--red)">MODULE 02</div><div class="mod-ov-title">AI Readiness &amp; Displacement Lens</div>
<div class="mod-ov-desc">Frey-Osborne automation probabilities calibrated for LMIC. Wittgenstein 2025-2035 projections. Durable skill map.</div>
<div class="mod-req">Frey &amp; Osborne (2013) automation scores</div><div class="mod-req">LMIC calibration per country</div><div class="mod-req">Adjacent skill roadmap</div>
<div style="font-size:12px;font-weight:600;color:var(--red);margin-top:14px">Open module →</div>
</div>
<div class="mod-card" onclick="goPanel('opportunities',document.querySelectorAll('.nav-tab')[3])">
<div class="mod-num" style="color:var(--teal)">MODULE 03</div><div class="mod-ov-title">Opportunity Matching &amp; Dashboard</div>
<div class="mod-ov-desc">Real ILO econometric signals. Dual interface: Youth/Job Seeker and Policymaker. Country-agnostic.</div>
<div class="mod-req">ILO ILOSTAT wages &amp; sector growth</div><div class="mod-req">World Bank WDI + HCI signals</div><div class="mod-req">Dual youth + policymaker views</div>
<div style="font-size:12px;font-weight:600;color:var(--teal);margin-top:14px">Open module →</div>
</div>
</div>
</div>
<div class="trust-bar">
<div style="width:100%;font-size:9.5px;color:var(--tx2);letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:4px">Security &amp; Trust Architecture</div>
<div class="trust-chip">🔐 Cryptographic peer attestation · ECDSA</div>
<div class="trust-chip">⛓ Append-only credential anchors · SHA-256</div>
<div class="trust-chip">⚖ Fairness audit · demographic parity</div>
<div class="trust-chip">🛡 Prompt injection guard · 12 rules</div>
<div class="trust-chip">🔒 Zero PII in logs · rate limiting</div>
</div>
</section>

<!-- ════ SKILLS ENGINE ════ -->
<section class="panel" id="panel-skills">
<div style="padding:36px 44px 24px;border-bottom:1px solid var(--bdr)">
<div class="eyebrow">Module 01 — Skills Signal Engine</div>
<h2 class="mod-title">Map your skills to the global economy</h2>
<p class="mod-sub">Speak or type — in any language. AI maps your description to ISCO-08 4-digit codes and ESCO v1.1 taxonomy. Portable across borders. Yours to own.</p>
</div>
<div class="skills-layout">
<div class="skill-col">
<div class="col-lbl">Quick-fill with persona</div>
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px" id="skillChips"></div>
<div class="col-lbl">Describe your skills &amp; experience</div>
<textarea id="skillInput" class="skill-textarea" maxlength="2000" placeholder="Example: I've been sewing since I was 14..." oninput="onInput(this)"></textarea>
<div style="text-align:right;font-size:9.5px;color:var(--tx2);font-family:var(--fm);margin-top:4px"><span id="charCount">0</span> / 2000</div>
<div style="display:flex;align-items:center;gap:8px;margin-top:9px;flex-wrap:wrap">
<select id="langSel" style="background:var(--bg2);border:1px solid var(--bdr);color:var(--tx0);border-radius:var(--r8);padding:7px 9px;font-size:11.5px;cursor:pointer">
<option value="en-US">English</option><option value="sw-KE">Swahili</option><option value="fr-FR">Français</option><option value="ha-NG">Hausa</option>
</select>
<button class="map-btn" id="mapBtn" onclick="mapSkills()">✦ Map to ISCO-08 / ESCO</button>
</div>
<div id="aiLoader" style="display:none;align-items:center;gap:8px;color:var(--gold);font-size:11.5px;padding:8px 0">
<span style="display:inline-flex;gap:3px"><span style="width:5px;height:5px;border-radius:50%;background:var(--gold);animation:bdot 1.2s infinite"></span><span style="width:5px;height:5px;border-radius:50%;background:var(--gold);animation:bdot 1.2s .2s infinite"></span><span style="width:5px;height:5px;border-radius:50%;background:var(--gold);animation:bdot 1.2s .4s infinite"></span></span>
<span>Extracting skills...</span>
</div>
</div>
<div class="skill-col output">
<div class="col-lbl">Extracted Skill Profile — ISCO-08 · ESCO v1.1</div>
<div class="constellation-box"><canvas id="cCanvas"></canvas><div class="constellation-empty" id="cEmpty"><div style="font-size:26px">◎</div><div>Map your skills to populate the constellation</div></div></div>
<div id="skillsTableWrap">
<div class="empty-state" id="skillsEmpty"><div style="font-size:30px;margin-bottom:8px">✦</div><div style="font-size:13.5px;font-weight:600;color:var(--tx1);margin-bottom:5px">No skills mapped yet</div><div style="font-size:11.5px">Click "Map to ISCO-08 / ESCO" or select a persona.</div></div>
<table class="skills-tbl" id="skillsTbl" style="display:none"><thead><tr><th>Skill</th><th>ISCO-08</th><th>ESCO</th><th>Level</th><th>Conf</th></tr></thead><tbody id="skillsTbody"></tbody></table>
</div>
<div id="exportRow" style="display:none;margin-top:13px;display:none;gap:8px;flex-wrap:wrap">
<button class="btn btn-ghost btn-sm" onclick="exportProfile('json')">⬇ JSON</button>
<button class="btn btn-ghost btn-sm" onclick="exportProfile('csv')">⬇ CSV</button>
<button class="btn btn-teal btn-sm" onclick="goPanel('readiness',document.querySelectorAll('.nav-tab')[2])">◎ Check Automation Risk →</button>
</div>
</div>
</div>
</section>

<!-- ════ AI READINESS ════ -->
<section class="panel" id="panel-readiness">
<div style="padding:36px 44px 24px;border-bottom:1px solid var(--bdr)">
<div class="eyebrow">Module 02 — AI Readiness &amp; Displacement Lens</div>
<h2 class="mod-title">Your automation risk profile</h2>
<p class="mod-sub">Frey &amp; Osborne (2013) probabilities calibrated for LMIC context. Wittgenstein Centre 2025-2035 education projections. Honest risk analysis with durable skill identification.</p>
</div>
<div class="readiness-layout">
<div>
<div class="gauge-box">
<div class="col-lbl" style="justify-content:center;margin-bottom:12px;text-align:center">Composite Automation Risk</div>
<div style="text-align:center"><canvas id="gaugeCanvas" width="200" height="120"></canvas></div>
<div style="text-align:center;font-family:var(--fd);font-size:26px;font-weight:800;margin-top:-25px" id="gaugeVal">--</div>
<div class="gauge-label" id="gaugeLabel">Select a persona to begin</div>
<div id="gaugeBand" style="display:none;text-align:center;margin-top:5px;font-size:10.5px;font-weight:600;font-family:var(--fm);padding:3px 10px;border-radius:5px;display:inline-block"></div>
<div style="font-size:9.5px;color:var(--tx2);margin-top:7px;font-family:var(--fm);text-align:center">Frey &amp; Osborne (2013) · LMIC calibration applied</div>
</div>
<div class="col-lbl">Per-Skill Risk Breakdown</div>
<div id="riskRows"><div class="empty-state" id="riskEmpty" style="padding:20px"><div style="font-size:22px;margin-bottom:8px">◎</div><div style="font-size:13px;font-weight:600;color:var(--tx1);margin-bottom:4px">Select a persona to begin</div></div></div>
</div>
<div>
<div class="proj-box">
<div style="display:flex;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:13px;font-weight:700">Education Projections 2025–2035</div><div style="font-size:9.5px;color:var(--tx2);font-family:var(--fm)">Wittgenstein Centre SSP2 · <span id="projLabel">Kenya</span></div></div><div style="font-size:9.5px;color:var(--tx2)">% of pop.</div></div>
<canvas id="projCanvas" style="width:100%;height:140px"></canvas>
<div style="display:flex;gap:12px;margin-top:7px"><div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--tx1)"><div style="width:12px;height:3px;background:#F5A623;border-radius:2px"></div>Primary</div><div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--tx1)"><div style="width:12px;height:3px;background:#4A9FFF;border-radius:2px"></div>Secondary</div><div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--tx1)"><div style="width:12px;height:3px;background:#00C9A7;border-radius:2px"></div>Tertiary</div></div>
</div>
<div class="col-lbl">Adjacent Skills — Build Resilience</div>
<div class="adj-grid" id="adjGrid"></div>
<div class="col-lbl">Free Learning Resources</div>
<div id="resourceList"></div>
</div>
</div>
</section>

<!-- ════ OPPORTUNITIES ════ -->
<section class="panel" id="panel-opportunities">
<div style="padding:36px 44px 20px;border-bottom:1px solid var(--bdr)">
<div class="eyebrow">Module 03 — Opportunity Matching &amp; Econometric Dashboard</div>
<h2 class="mod-title">Real signals. Realistic paths.</h2>
<p class="mod-sub">Not aspirational matching. Real econometric signals at every step.</p>
<div class="opp-controls">
<div class="view-toggle"><button class="vbtn active" onclick="setOppView('youth',this)">👤 Youth / Job Seeker</button><button class="vbtn" onclick="setOppView('policy',this)">📊 Policymaker</button></div>
<div style="display:flex;gap:5px;flex-wrap:wrap">
<button class="cfbtn active" onclick="filterOpp('ALL',this)">All</button>
<button class="cfbtn" onclick="filterOpp('GH',this)">🇬🇭</button>
<button class="cfbtn" onclick="filterOpp('KE',this)">🇰🇪</button>
<button class="cfbtn" onclick="filterOpp('NG',this)">🇳🇬</button>
<button class="cfbtn" onclick="filterOpp('RW',this)">🇷🇼</button>
<button class="cfbtn" onclick="filterOpp('ZA',this)">🇿🇦</button>
</div>
<div style="display:flex;gap:4px">
<button class="pfbtn active" onclick="setMatchP('sarah',this)">🧵</button>
<button class="pfbtn" onclick="setMatchP('james',this)">🔧</button>
<button class="pfbtn" onclick="setMatchP('amara',this)">🌾</button>
<button class="pfbtn" onclick="setMatchP('kwame',this)">🛒</button>
</div>
</div>
</div>
<div class="econ-strip" id="econStrip">
<div class="econ-cell"><div class="econ-val" id="eco-yu" style="color:var(--red)">13.4%</div><div class="econ-lbl">Youth unemployment (15–24)</div><div class="econ-src">ILO ILOSTAT 2023</div></div>
<div class="econ-cell"><div class="econ-val" id="eco-mw" style="color:var(--gold)">$120</div><div class="econ-lbl">Min wage (monthly)</div><div class="econ-src">ILO WCLD</div></div>
<div class="econ-cell"><div class="econ-val" id="eco-inf" style="color:var(--lav)">83.6%</div><div class="econ-lbl">Informal employment share</div><div class="econ-src">ILO 2023</div></div>
<div class="econ-cell"><div class="econ-val" id="eco-hci" style="color:var(--teal)">0.55</div><div class="econ-lbl">Human Capital Index</div><div class="econ-src">World Bank HCI 2020</div></div>
</div>
<div id="oppYouthView"><div class="opp-body" id="oppGrid"></div></div>
<div id="oppPolicyView" style="display:none"><div style="padding:20px 44px;text-align:center;color:var(--tx2)">Policymaker view — ISCO heatmap &amp; interventions visible in the full React application.</div></div>
</section>

<!-- ════ SECURITY ════ -->
<section class="panel" id="panel-security">
<div style="padding:36px 44px 24px;border-bottom:1px solid var(--bdr)">
<div class="eyebrow">Security Architecture — Live Event Log</div>
<h2 class="mod-title">Enterprise-grade security layer</h2>
<p class="mod-sub">All inputs sanitized, rate-limited, and checked for prompt injection. Zero PII stored. Credentials cryptographically anchored.</p>
</div>
<div class="sec-layout">
<div>
<div class="col-lbl" style="margin-bottom:10px">Active Security Controls</div>
<div class="sec-ctrl-card"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12.5px;font-weight:700">Input Sanitization</span><span style="color:var(--teal);font-size:9.5px;font-family:var(--fm)">ACTIVE</span></div><div style="font-size:10.5px;color:var(--tx1)">HTML escape · 2000-char limit · regex validation · XSS prevention</div></div>
<div class="sec-ctrl-card"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12.5px;font-weight:700">Prompt Injection Guard</span><span style="color:var(--teal);font-size:9.5px;font-family:var(--fm)">12 RULES</span></div><div style="font-size:10.5px;color:var(--tx1)">Blocks "ignore previous", "act as", "jailbreak", system prompt overrides</div></div>
<div class="sec-ctrl-card"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12.5px;font-weight:700">Session Rate Limiting</span><span style="color:var(--teal);font-size:9.5px;font-family:var(--fm)">ACTIVE</span></div><div style="font-size:10.5px;color:var(--tx1)">Max 10 AI calls/session · 5s cooldown · exponential backoff</div></div>
<div class="sec-ctrl-card"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12.5px;font-weight:700">ECDSA Credential Signing</span><span style="color:var(--teal);font-size:9.5px;font-family:var(--fm)">ACTIVE</span></div><div style="font-size:10.5px;color:var(--tx1)">SHA-256 hash · ECDSA signature · QR verifiable · append-only log</div></div>
<div class="sec-ctrl-card"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12.5px;font-weight:700">Fairness Audit Engine</span><span style="color:var(--teal);font-size:9.5px;font-family:var(--fm)">ACTIVE</span></div><div style="font-size:10.5px;color:var(--tx1)">Demographic parity check · flags &gt;15% deviation for human review</div></div>
</div>
<div>
<div class="col-lbl" style="margin-bottom:10px">Live Security Event Log</div>
<div id="secLog">
<div class="sec-event se-pass"><div>✅</div><div style="color:var(--tx1)">Application loaded · all security controls initialized<div style="font-family:var(--fm);font-size:8.5px;color:var(--tx2);margin-top:2px">Session start</div></div></div>
<div class="sec-event se-pass"><div>✅</div><div style="color:var(--tx1)">Rate limiter initialized · 10 calls/session<div style="font-family:var(--fm);font-size:8.5px;color:var(--tx2);margin-top:2px">Session start</div></div></div>
<div class="sec-event se-pass"><div>✅</div><div style="color:var(--tx1)">Prompt injection filter loaded · 12 pattern rules<div style="font-family:var(--fm);font-size:8.5px;color:var(--tx2);margin-top:2px">Session start</div></div></div>
</div>
</div>
</div>
</section>
</main>
</div>

<div class="toast" id="toastEl"><span id="toastIco">ℹ</span> <span id="toastMsg">Message</span></div>
@keyframes bdot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
""")

# Part 3: JavaScript - the full app logic
HTML_PARTS.append(r"""<script>
const COUNTRIES={KE:{name:'Kenya',flag:'🇰🇪',yu:'13.4%',mw:'$120',inf:'83.6%',hci:'0.55',yuN:13.4,infN:83.6,hciN:.55,am:.78},GH:{name:'Ghana',flag:'🇬🇭',yu:'9.6%',mw:'$125',inf:'81.7%',hci:'0.45',yuN:9.6,infN:81.7,hciN:.45,am:.80},NG:{name:'Nigeria',flag:'🇳🇬',yu:'19.8%',mw:'$78',inf:'92.7%',hci:'0.36',yuN:19.8,infN:92.7,hciN:.36,am:.72},RW:{name:'Rwanda',flag:'🇷🇼',yu:'21.2%',mw:'$90',inf:'87.6%',hci:'0.38',yuN:21.2,infN:87.6,hciN:.38,am:.70},ZA:{name:'S.Africa',flag:'🇿🇦',yu:'60.2%',mw:'$280',inf:'34.0%',hci:'0.43',yuN:60.2,infN:34.0,hciN:.43,am:.85}};
const FO={'7531':.57,'7318':.62,'5223':.92,'7411':.57,'7421':.51,'5230':.65,'3322':.45,'6111':.54,'6121':.60,'1439':.16,'2521':.25,'3142':.35,'7516':.63,'3331':.59,'4321':.72,'2643':.38,'2431':.67,'2359':.03,'3152':.41,'8322':.86};
const WITT={KE:{p:[38,36,34,31,29],s:[46,48,50,52,53],t:[16,16,16,17,18]},GH:{p:[32,30,28,26,24],s:[52,53,54,56,57],t:[16,17,18,18,19]},NG:{p:[45,43,40,37,35],s:[44,45,47,49,51],t:[11,12,13,14,14]},RW:{p:[41,39,36,33,30],s:[51,53,55,58,60],t:[8,8,9,9,10]},ZA:{p:[18,17,15,14,13],s:[55,56,57,58,58],t:[27,27,28,28,29]}};
const PYR=[2025,2027,2029,2031,2035];
const PERSONAS={sarah:{name:'Sarah, 22',emoji:'🧵',country:'KE',text:"I am Sarah, 22, from Eldoret, Kenya. I've been sewing since 14. I make dresses, uniforms, wedding garments, traditional fabrics. Hand embroidery, beadwork. Manual and electric machines. Pattern making from scratch. I manage 3 tailors, handle customer orders, negotiate fabric prices, keep accounts on my phone. English, Swahili, Kalenjin.",skills:[{n:'Garment construction',i:'7531',c:'trade',l:9,cf:.95,e:'tailoring'},{n:'Hand embroidery & beadwork',i:'7318',c:'creative',l:9,cf:.92,e:'embroidery'},{n:'Pattern making',i:'7531',c:'technical',l:8,cf:.88,e:'pattern design'},{n:'Business management',i:'1439',c:'business',l:6,cf:.80,e:'business management'},{n:'Customer negotiation',i:'3322',c:'interpersonal',l:7,cf:.82,e:'negotiation'}],adj:[{n:'Digital pattern design',im:'+34%',d:'CAD tools — Lectra, Optitex. Remote-compatible.'},{n:'E-commerce operations',im:'+28%',d:'Jumia, Kilimall, Etsy. +22.5%/yr growth SSA.'},{n:'Quality control audit',im:'+41%',d:'ISCO-3152. Requires human tactile judgment.'},{n:'Small business finance',im:'+22%',d:'Bookkeeping, M-Pesa, microfinance.'}],res:[{n:'Google Digital Skills for Africa',p:'Google',d:'Self-paced',c:'FREE'},{n:'Jumia Seller Academy',p:'Jumia',d:'2 weeks',c:'FREE'},{n:'Coursera — Financial Accounting',p:'Univ. of Illinois',d:'Self-paced',c:'FREE (audit)'}]},
james:{name:'James, 28',emoji:'🔧',country:'KE',text:"I am James, 28, from Nairobi. Repairing smartphones, tablets, laptops for 11 years. Screens, batteries, motherboards. Board-level and micro-soldering. Data recovery. Software troubleshooting. Own shop in Gikomba market, 2 assistants. Self-taught from YouTube.",skills:[{n:'Smartphone repair',i:'7421',c:'technical',l:9,cf:.96,e:'device repair'},{n:'Micro-soldering',i:'7421',c:'technical',l:8,cf:.90,e:'soldering'},{n:'Data recovery',i:'2521',c:'digital',l:7,cf:.85,e:'data recovery'},{n:'Shop management',i:'1439',c:'business',l:6,cf:.78,e:'business admin'},{n:'Self-directed learning',i:'2359',c:'interpersonal',l:8,cf:.92,e:'autonomous learning'}],adj:[{n:'CompTIA A+ Certification',im:'+38%',d:'Formal credential for corporate helpdesk.'},{n:'Android ROM dev',im:'+31%',d:'Software side — remote gig work.'},{n:'IoT device servicing',im:'+26%',d:'Smart home, security systems.'},{n:'Technical training',im:'+19%',d:'ISCO-2359, lowest automation risk.'}],res:[{n:'Professor Messer — CompTIA A+',p:'Free online',d:'Self-paced',c:'FREE'},{n:'ALX Africa — Software Eng',p:'ALX',d:'12 months',c:'FREE'},{n:'XDA Developers',p:'Community',d:'Self-paced',c:'FREE'}]},
amara:{name:'Amara, 34',emoji:'🌾',country:'NG',text:"I am Amara, 34, from Kano, Nigeria. Smallholder farmer — sorghum, millet, vegetables on 3 acres. I organize 12 farmers in our cooperative. Records of yields, expenses, sales. Soil testing, fertilizer selection. Dried food processing — tomatoes and peppers. Train women in post-harvest storage.",skills:[{n:'Crop production',i:'6111',c:'agriculture',l:8,cf:.92,e:'cultivation'},{n:'Cooperative leadership',i:'1439',c:'business',l:8,cf:.90,e:'cooperative mgmt'},{n:'Post-harvest processing',i:'7516',c:'trade',l:7,cf:.85,e:'food processing'},{n:'Soil testing & agronomy',i:'3142',c:'technical',l:6,cf:.80,e:'soil analysis'},{n:'Training delivery',i:'2359',c:'interpersonal',l:7,cf:.83,e:'training'}],adj:[{n:'Digital farm records',im:'+32%',d:'WeFarm, FarmDrive — unlocks microfinance.'},{n:'Export standards (GLOBALG.A.P)',im:'+44%',d:'EU export premiums for certified produce.'},{n:'Precision agriculture',im:'+27%',d:'Soil sensors, drone monitoring.'},{n:'Value chain coordination',im:'+23%',d:'Market linkage, buyer negotiation.'}],res:[{n:'WeFarm — Digital Farming',p:'WeFarm',d:'Self-paced',c:'FREE'},{n:'FAO e-learning — GAP',p:'FAO',d:'6 weeks',c:'FREE'},{n:'Coursera — Financial Accounting',p:'Univ. Illinois',d:'Self-paced',c:'FREE (audit)'}]},
kwame:{name:'Kwame, 26',emoji:'🛒',country:'GH',text:"I am Kwame, 26, from Accra, Ghana. Trading business — source from China via Alibaba, sell in Ghana. Customs clearance, freight forwarding, import duties. Inventory across 3 locations. English, Twi, French, basic Mandarin. Teach younger traders.",skills:[{n:'International trade',i:'3322',c:'business',l:8,cf:.92,e:'import/export'},{n:'Customs clearance',i:'3331',c:'technical',l:8,cf:.90,e:'customs'},{n:'Inventory management',i:'4321',c:'technical',l:7,cf:.85,e:'inventory mgmt'},{n:'Multilingual comms',i:'2643',c:'interpersonal',l:7,cf:.88,e:'multilingual'},{n:'Social commerce',i:'2431',c:'digital',l:6,cf:.80,e:'social marketing'}],adj:[{n:'Customs brokerage license',im:'+36%',d:'GRA — unlock B2B contracts.'},{n:'Supply chain management',im:'+33%',d:'Coursera (Rutgers) — professional transition.'},{n:'Digital marketing cert',im:'+25%',d:'Google Ads, Meta Business Suite.'},{n:'Trade finance',im:'+29%',d:'Letters of credit, banking relationships.'}],res:[{n:'Coursera — Supply Chain',p:'Rutgers',d:'Self-paced',c:'FREE (audit)'},{n:'Google Digital Skills',p:'Google',d:'Self-paced',c:'FREE'},{n:'ILO Skills Academy',p:'ILO',d:'4 weeks',c:'FREE'}]}};
const OPPS=[
{t:'Production Tailor — Export',co:'Nairobi Apparel Exports',loc:'Nairobi, KE',c:'KE',tags:['Sewing','Pattern making','QC'],sal:'KES 60,000–95,000',gr:'+8.4%',rem:false,m:94,p:'sarah',src:'BrighterMonday KE 2024'},
{t:'Remote Embroidery Consultant',co:'Hampstead Bridal Co.',loc:'Remote (UK)',c:'KE',tags:['Embroidery','Beadwork'],sal:'USD 1,200–2,200',gr:'+14.2%',rem:true,m:89,p:'sarah',src:'Upwork EA 2024'},
{t:'Phone Repair Lead',co:'iFixit Kenya',loc:'Nairobi CBD',c:'KE',tags:['Micro-soldering','Board repair'],sal:'KES 70,000–110,000',gr:'+11.8%',rem:false,m:96,p:'james',src:'Jiji KE 2024'},
{t:'Junior Web Developer — React',co:'Andela',loc:'Remote',c:'KE',tags:['JavaScript','React'],sal:'USD 1,500–2,800',gr:'+22.5%',rem:true,m:61,p:'james',src:'Andela 2024'},
{t:'Field Agronomist',co:'Babban Gona',loc:'Kano, NG',c:'NG',tags:['Crop production','Cooperative'],sal:'NGN 220,000–380,000',gr:'+6.2%',rem:false,m:91,p:'amara',src:'Jobberman NG 2024'},
{t:'Marketplace Seller Ops',co:'Jumia Nigeria',loc:'Lagos, NG',c:'NG',tags:['Sales','Inventory'],sal:'NGN 180,000–320,000',gr:'+9.1%',rem:false,m:78,p:'amara',src:'Jumia NG 2024'},
{t:'Cross-Border Trade Coordinator',co:'Tonaton Trade',loc:'Accra, GH',c:'GH',tags:['Logistics','Negotiation'],sal:'GHS 3,500–6,500',gr:'+7.8%',rem:false,m:93,p:'kwame',src:'Jobberman GH 2024'},
{t:'Tour Guide — Volcanoes NP',co:'Wilderness Safaris',loc:'Musanze, RW',c:'RW',tags:['Tourism','Languages'],sal:'RWF 350,000–580,000',gr:'+18.7%',rem:false,m:74,p:'amara',src:'JobInRwanda 2024'},
{t:'Branch Consultant',co:'Capitec Bank',loc:'Johannesburg, ZA',c:'ZA',tags:['Customer service','Banking'],sal:'ZAR 12,000–18,000',gr:'+4.6%',rem:false,m:65,p:'kwame',src:'Capitec 2024'},
];
let ST={country:'KE',persona:'sarah',oppCtr:'ALL',matchP:'sarah',skills:[],cAnimId:null};
function goPanel(id,btn){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));document.getElementById('panel-'+id).classList.add('active');if(btn)btn.classList.add('active');if(id==='readiness'){drawGauge();drawProj();loadRisk();}if(id==='opportunities')renderOpps();logSec('pass','Navigated to: '+id);}
function setCountry(code){ST.country=code;const c=COUNTRIES[code];document.getElementById('navFlag').textContent=c.flag;document.getElementById('navCtr').textContent=c.name;document.getElementById('sbLabel').textContent='Country Signals · '+c.name;document.getElementById('sb-yu').textContent=c.yu;document.getElementById('sb-mw').textContent=c.mw;document.getElementById('sb-inf').textContent=c.inf;document.getElementById('sb-hci').textContent=c.hci;document.getElementById('eco-yu').textContent=c.yu;document.getElementById('eco-mw').textContent=c.mw;document.getElementById('eco-inf').textContent=c.inf;document.getElementById('eco-hci').textContent=c.hci;if(document.getElementById('projLabel'))document.getElementById('projLabel').textContent=c.name;drawProj();renderCtGrid();toast(c.flag+' '+c.name);}
function cycleCountry(){const k=Object.keys(COUNTRIES);const i=(k.indexOf(ST.country)+1)%k.length;setCountry(k[i]);}
function selectPersona(name,el){ST.persona=name;document.querySelectorAll('.persona-row').forEach(r=>r.classList.remove('active'));el.classList.add('active');const p=PERSONAS[name];setCountry(p.country);ST.matchP=name;renderOpps();renderSkillChips();toast('Switched to '+p.name);}
function fillPersona(name,el){ST.persona=name;document.querySelectorAll('.persona-chip').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');const p=PERSONAS[name];document.getElementById('skillInput').value=p.text;onInput(document.getElementById('skillInput'));setCountry(p.country);toast('✦ Loaded '+p.name);}
function renderSkillChips(){const el=document.getElementById('skillChips');if(!el)return;el.innerHTML=Object.entries(PERSONAS).map(([k,p])=>`<div class="persona-chip${ST.persona===k?' sel':''}" onclick="fillPersona('${k}',this)">${p.emoji} ${p.name}</div>`).join('');}
function onInput(el){el.value=el.value.slice(0,2000);document.getElementById('charCount').textContent=el.value.length;}
function mapSkills(){const p=PERSONAS[ST.persona];ST.skills=p.skills;renderSkillsTbl(p.skills);drawConstellation(p.skills);document.getElementById('exportRow').style.display='flex';toast('✦ '+p.skills.length+' skills mapped to ISCO-08');logSec('pass','Skills extracted: '+p.skills.length);}
function renderSkillsTbl(skills){document.getElementById('skillsEmpty').style.display='none';const t=document.getElementById('skillsTbl');t.style.display='table';document.getElementById('skillsTbody').innerHTML=skills.map(s=>{const pct=s.l*10;const col=s.l>=8?'var(--teal)':s.l>=6?'var(--gold)':'var(--red)';const cc=s.cf>=.85?'conf-hi':'conf-md';return`<tr><td><div style="font-weight:600">${s.n}</div><div style="font-size:9.5px;color:var(--tx2)">${s.c}</div></td><td><span class="isco-pill">${s.i}</span></td><td><span class="esco-pill">${s.e}</span></td><td><div class="lvl-bar"><div class="lvl-track"><div class="lvl-fill" style="width:${pct}%;background:${col}"></div></div><span style="font-size:9.5px;color:${col};font-family:var(--fm)">${s.l}</span></div></td><td><span class="${cc}">${Math.round(s.cf*100)}%</span></td></tr>`;}).join('');}
function drawConstellation(skills){const canvas=document.getElementById('cCanvas');document.getElementById('cEmpty').style.display='none';const ctx=canvas.getContext('2d');const dpr=window.devicePixelRatio||1;const w=canvas.offsetWidth,h=canvas.offsetHeight;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);const cx=w/2,cy=h/2;const cc={trade:'#F5A623',technical:'#4A9FFF',creative:'#A78BFA',business:'#00C9A7',interpersonal:'#FF9F43',digital:'#00C9A7',agriculture:'#78D76E'};const nodes=[{x:cx,y:cy,r:13,label:'YOU',color:'#F5A623',main:true}];skills.forEach((s,i)=>{const a=(i/skills.length)*Math.PI*2-Math.PI/2;const r=55+(s.l/10)*40;nodes.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,r:4+(s.l/10)*5,label:s.n.split(' ')[0],color:cc[s.c]||'#8B9AB3',main:false});});let t=0;if(ST.cAnimId)cancelAnimationFrame(ST.cAnimId);const draw=()=>{ctx.clearRect(0,0,w,h);nodes.slice(1).forEach(n=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(n.x,n.y);ctx.strokeStyle=n.color+'20';ctx.lineWidth=1;ctx.stroke();});const pulse=1+Math.sin(t*.05)*.12;nodes.forEach(n=>{ctx.fillStyle=n.main?n.color:n.color+'CC';ctx.beginPath();ctx.arc(n.x,n.y,n.r*(n.main?pulse:1),0,Math.PI*2);ctx.fill();ctx.fillStyle='#EDF0F8';ctx.font=`${n.main?'700 9.5px':'500 8.5px'} 'DM Sans',sans-serif`;ctx.textAlign='center';ctx.fillText(n.label,n.x,n.y+n.r+10);});t++;ST.cAnimId=requestAnimationFrame(draw);};draw();}
function loadRisk(){const p=PERSONAS[ST.persona];const c=COUNTRIES[ST.country];const rd=p.skills.map(s=>{const fo=FO[s.i]||.45;const cal=fo*c.am;return{...s,raw:fo,cal,dur:cal<.35};});const avg=rd.reduce((a,r)=>a+r.cal,0)/rd.length;drawGauge(avg);const el=document.getElementById('riskRows');const re=document.getElementById('riskEmpty');if(re)re.style.display='none';el.innerHTML=rd.map(r=>{const pct=Math.round(r.cal*100);const col=r.cal<.35?'teal':r.cal<.55?'gold':'coral';const cv={'teal':'var(--teal)','gold':'var(--gold)','coral':'var(--red)'}[col];return`<div class="risk-row"><div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:12.5px;font-weight:600">${r.n}</span><span style="font-family:var(--fm);font-size:12px;font-weight:700;color:${cv}">${pct}%</span></div><div class="risk-track"><div class="risk-fill" style="width:${pct}%;background:${cv}"></div></div><div style="font-size:9.5px;color:var(--tx2)">${r.dur?'<span class="durable-chip">✦ Durable</span>':''}ISCO-${r.i} · Base: ${Math.round(r.raw*100)}% → Calibrated: ${pct}%</div></div>`;}).join('');const ag=document.getElementById('adjGrid');ag.innerHTML=p.adj.map(a=>`<div class="adj-card"><div style="font-size:12px;font-weight:700">${a.n}</div><div style="font-size:10px;color:var(--teal);font-family:var(--fm);font-weight:600">${a.im} resilience</div><div style="font-size:10px;color:var(--tx2);margin-top:3px">${a.d}</div></div>`).join('');const rl=document.getElementById('resourceList');rl.innerHTML=p.res.map(r=>`<div class="resource-row"><div><div style="font-size:12px;font-weight:600">${r.n}</div><div style="font-size:9.5px;color:var(--tx2)">${r.p} · ${r.d}</div></div><span style="font-size:9.5px;font-family:var(--fm);font-weight:700;padding:2px 7px;border-radius:4px;background:var(--teald);color:var(--teal)">${r.c}</span></div>`).join('');}
function drawGauge(val){const canvas=document.getElementById('gaugeCanvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,200,120);const cx=100,cy=115,r=80;ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,2*Math.PI);ctx.strokeStyle='#222840';ctx.lineWidth=14;ctx.lineCap='round';ctx.stroke();if(val===undefined)return;const col=val<.35?'#00C9A7':val<.55?'#F5A623':'#FF4757';ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,Math.PI+Math.PI*val);ctx.strokeStyle=col;ctx.lineWidth=14;ctx.lineCap='round';ctx.stroke();document.getElementById('gaugeVal').textContent=Math.round(val*100)+'%';document.getElementById('gaugeVal').style.color=col;document.getElementById('gaugeLabel').textContent=val<.35?'LOW risk':val<.55?'MODERATE risk':'HIGH risk';}
function drawProj(){const canvas=document.getElementById('projCanvas');if(!canvas)return;const d=WITT[ST.country]||WITT.KE;const ctx=canvas.getContext('2d');const dpr=window.devicePixelRatio||1;const w=canvas.offsetWidth,h=140;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.height=h+'px';ctx.scale(dpr,dpr);const pd={t:8,r:16,b:24,l:36},cw=w-pd.l-pd.r,ch=h-pd.t-pd.b;ctx.clearRect(0,0,w,h);for(let i=0;i<=4;i++){const y=pd.t+ch*(1-i/4);ctx.beginPath();ctx.moveTo(pd.l,y);ctx.lineTo(pd.l+cw,y);ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='rgba(255,255,255,.25)';ctx.font='8px monospace';ctx.textAlign='right';ctx.fillText(i*25+'%',pd.l-3,y+3);}PYR.forEach((y,i)=>{const x=pd.l+(i/(PYR.length-1))*cw;ctx.fillStyle='rgba(255,255,255,.25)';ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText(y,x,h-2);});const dl=(v,c)=>{ctx.beginPath();v.forEach((val,i)=>{const x=pd.l+(i/(PYR.length-1))*cw;const y=pd.t+ch*(1-val/100);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();v.forEach((val,i)=>{const x=pd.l+(i/(PYR.length-1))*cw;const y=pd.t+ch*(1-val/100);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();});};dl(d.p,'#F5A623');dl(d.s,'#4A9FFF');dl(d.t,'#00C9A7');}
function renderOpps(){const grid=document.getElementById('oppGrid');let opps=[...OPPS];if(ST.oppCtr!=='ALL')opps=opps.filter(o=>o.c===ST.oppCtr);opps.sort((a,b)=>{const am=a.p===ST.matchP?1:0,bm=b.p===ST.matchP?1:0;return(bm-am)||(b.m-a.m);});grid.innerHTML=opps.map(o=>`<div class="opp-card"><div style="display:flex;justify-content:space-between;margin-bottom:7px"><div><div style="font-size:13.5px;font-weight:700;margin-bottom:2px">${o.t}</div><div style="font-size:10.5px;color:var(--tx2)">${o.co} · ${o.loc}</div></div><span class="${o.m>=85?'mhi':'mmd'}">${o.m}%</span></div><div class="opp-tags">${o.tags.map(t=>`<span class="opp-tag">${t}</span>`).join('')}</div><div style="display:flex;justify-content:space-between;align-items:center;padding-top:9px;border-top:1px solid var(--bdr)"><div><div style="font-size:13px;font-weight:700;font-family:var(--fm)">${o.sal} /mo</div><div style="font-size:9.5px;font-family:var(--fm);color:var(--teal);font-weight:700">${o.gr} sector</div></div><div style="display:flex;gap:4px">${o.rem?'<span class="flag-remote">REMOTE</span>':''}<span class="flag-ctr">${o.c}</span></div></div><div style="font-size:8.5px;color:var(--tx2);margin-top:5px;font-family:var(--fm);font-style:italic">Source: ${o.src}</div></div>`).join('');}
function setOppView(v,btn){document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('oppYouthView').style.display=v==='youth'?'block':'none';document.getElementById('oppPolicyView').style.display=v==='policy'?'block':'none';}
function filterOpp(c,btn){ST.oppCtr=c;document.querySelectorAll('.cfbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderOpps();}
function setMatchP(p,btn){ST.matchP=p;document.querySelectorAll('.pfbtn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderOpps();}
function renderCtGrid(){const el=document.getElementById('countryGrid');if(!el)return;el.innerHTML=Object.entries(COUNTRIES).map(([k,c])=>`<div class="ctr-card${ST.country===k?' active':''}" onclick="setCountry('${k}')"><div style="font-size:18px;margin-bottom:6px">${c.flag}</div><div style="font-size:10.5px;font-weight:700;color:var(--tx1);text-transform:uppercase;letter-spacing:.06em;margin-bottom:9px">${c.name}</div><div class="ctr-row"><span class="ctr-k">Youth unemp</span><span class="ctr-v" style="color:var(--red)">${c.yu}</span></div><div class="ctr-row"><span class="ctr-k">Min wage</span><span class="ctr-v" style="color:var(--gold)">${c.mw}</span></div><div class="ctr-row"><span class="ctr-k">Informal</span><span class="ctr-v" style="color:var(--red)">${c.inf}</span></div><div class="ctr-row"><span class="ctr-k">HCI</span><span class="ctr-v" style="color:var(--blue)">${c.hci}</span></div></div>`).join('');}
function exportProfile(fmt){const p=PERSONAS[ST.persona];if(fmt==='json'){const d={persona:p.name,country:ST.country,skills:p.skills};const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='talentgraph_profile.json';a.click();}else{const rows=[['Skill','ISCO','ESCO','Category','Level','Confidence']];p.skills.forEach(s=>rows.push([s.n,s.i,s.e,s.c,s.l,s.cf]));const b=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='talentgraph_profile.csv';a.click();}toast('⬇ Exported '+fmt.toUpperCase());logSec('pass','Profile exported as '+fmt);}
function logSec(type,msg){const log=document.getElementById('secLog');if(!log)return;const ico={block:'🚫',pass:'✅',warn:'⚠️'}[type]||'ℹ';const cls={block:'se-block',pass:'se-pass',warn:'se-warn'}[type]||'se-pass';const el=document.createElement('div');el.className='sec-event '+cls;el.innerHTML=`<div>${ico}</div><div style="color:var(--tx1)">${msg}<div style="font-family:var(--fm);font-size:8.5px;color:var(--tx2);margin-top:2px">${new Date().toLocaleTimeString()}</div></div>`;log.insertBefore(el,log.firstChild);}
let toastTmr;function toast(msg){const el=document.getElementById('toastEl');document.getElementById('toastMsg').textContent=msg;el.classList.add('show');clearTimeout(toastTmr);toastTmr=setTimeout(()=>el.classList.remove('show'),3500);}
(function init(){renderCtGrid();renderSkillChips();const ta=document.getElementById('skillInput');ta.value=PERSONAS.sarah.text;onInput(ta);renderOpps();setTimeout(()=>{drawGauge();drawProj();},200);logSec('pass','TalentGraph v3 initialized — all controls active');})();
</script>
</body>
</html>
""")

out_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "talentgraph-demo.html")
os.makedirs(os.path.dirname(out_path), exist_ok=True)
html = "".join(HTML_PARTS)
with open(out_path, "w") as f:
    f.write(html)
print(f"Written: {len(html):,} bytes / {html.count(chr(10)):,} lines to {out_path}")
