import { useState, useMemo, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CODE TABLES
// ═══════════════════════════════════════════════════════════════════════════════
const UL = 999999;

const OCC_LOAD_FACTORS = {
  "M":60,"B":100,"A-1":15,"A-2":15,"A-3":15,"A-4":15,
  "R-1":200,"R-2":200,"S-1":300,"S-2":300,"E":20,
  "F-1":200,"F-2":200,"I-1":105,"I-2":240,"H-1":75,"U":300,
};
const ALLOW_AREA_NS = {
  "M":  {"I-A":UL,"I-B":UL,"II-A":21500,"II-B":21500,"III-A":21500,"III-B":21500,"IV":36000,"V-A":18500,"V-B":9000},
  "B":  {"I-A":UL,"I-B":UL,"II-A":28500,"II-B":28500,"III-A":19000,"III-B":19000,"IV":36000,"V-A":18000,"V-B":9000},
  "A-2":{"I-A":UL,"I-B":UL,"II-A":14400,"II-B":14400,"III-A":14400,"III-B":14400,"IV":14400,"V-A":11500,"V-B":9500},
  "R-2":{"I-A":UL,"I-B":UL,"II-A":24000,"II-B":24000,"III-A":24000,"III-B":24000,"IV":20500,"V-A":16000,"V-B":7000},
  "S-1":{"I-A":UL,"I-B":UL,"II-A":17500,"II-B":17500,"III-A":17500,"III-B":17500,"IV":25500,"V-A":14000,"V-B":9000},
  "E":  {"I-A":UL,"I-B":UL,"II-A":23100,"II-B":23100,"III-A":23100,"III-B":23100,"IV":25500,"V-A":18500,"V-B":9500},
};
const ALLOW_STORIES_NS = {
  "M":  {"I-A":UL,"I-B":11,"II-A":4,"II-B":4,"III-A":4,"III-B":4,"IV":5,"V-A":3,"V-B":2},
  "B":  {"I-A":UL,"I-B":11,"II-A":5,"II-B":5,"III-A":5,"III-B":5,"IV":5,"V-A":4,"V-B":3},
  "A-2":{"I-A":UL,"I-B":11,"II-A":2,"II-B":2,"III-A":2,"III-B":2,"IV":2,"V-A":2,"V-B":1},
  "R-2":{"I-A":UL,"I-B":11,"II-A":4,"II-B":4,"III-A":4,"III-B":4,"IV":4,"V-A":4,"V-B":4},
  "S-1":{"I-A":UL,"I-B":11,"II-A":4,"II-B":4,"III-A":3,"III-B":3,"IV":4,"V-A":3,"V-B":2},
  "E":  {"I-A":UL,"I-B":UL,"II-A":3,"II-B":3,"III-A":2,"III-B":2,"IV":2,"V-A":1,"V-B":1},
};
const ALLOW_HT_NS = {
  "I-A":UL,"I-B":160,"II-A":55,"II-B":55,"III-A":50,"III-B":50,"IV":65,"V-A":50,"V-B":40
};
const TRAVEL_DIST = {
  "M":[200,250],"B":[200,300],"A-1":[200,250],"A-2":[200,250],"A-3":[200,250],
  "R-1":[200,250],"R-2":[200,250],"S-1":[200,250],"S-2":[300,400],
  "E":[200,250],"F-1":[200,250],"F-2":[300,400],"I-1":[200,250],"H-1":[75,75],"U":[200,300],
};
const LIVE_LOADS = {
  "M":125,"B":50,"A-1":60,"A-2":100,"A-3":100,"R-1":40,
  "R-2":40,"S-1":125,"S-2":125,"E":40,"F-1":125,"I-1":40,"H-1":125,"U":40,
};
const SINGLE_EXIT_MAX = {"A":49,"B":49,"E":49,"F":49,"M":49,"R":10,"S":29,"U":49};
const CT_ORDER = ["V-B","V-A","IV","III-B","III-A","II-B","II-A","I-B","I-A"];
const CT_LABEL = {
  "V-B":"V-B Wood Unprot.","V-A":"V-A Wood Prot.","IV":"IV Heavy Timber",
  "III-B":"III-B Comb.Int.Unprot.","III-A":"III-A Comb.Int.Prot.",
  "II-B":"II-B Noncomb.Unprot.","II-A":"II-A Noncomb.Prot.",
  "I-B":"I-B Noncomb.Full Prot.","I-A":"I-A Noncomb.Max",
};
const OCCS = ["M","B","A-1","A-2","A-3","R-1","R-2","S-1","S-2","E","F-1","I-1","H-1","U"];
const OCC_LABELS = {
  "M":"Mercantile","B":"Business","A-1":"Assembly-Theater","A-2":"Assembly-Rest.",
  "A-3":"Assembly-Gen.","R-1":"Hotel","R-2":"Apartment","S-1":"Storage Light",
  "S-2":"Storage Heavy","E":"Education","F-1":"Factory","I-1":"Institutional","H-1":"High-Hazard","U":"Utility",
};

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED COMPUTE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
function compute(inp) {
  const { occupancy:occ, constType:ct, stories, floorArea, heightFt, fireAreas, mixed } = inp;
  const fa=floorArea||0, ht=heightFt||0, st=stories||1, faa=fireAreas||1;
  const occKey = occ.split("-")[0];
  const loadFactor = OCC_LOAD_FACTORS[occ]||100;
  const occupantLoad = Math.ceil(fa/loadFactor);
  const occAreaTbl = ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"];
  const occStTbl   = ALLOW_STORIES_NS[occ]||ALLOW_STORIES_NS["B"];
  const allowNS = occAreaTbl[ct]||9000;
  const allowSA = allowNS===UL?UL:allowNS*3;
  const allowStNS = occStTbl[ct]||2;
  const allowStSA = allowStNS===UL?UL:allowStNS+3;
  const allowHtNS = ALLOW_HT_NS[ct]||40;
  const allowHtSA = allowHtNS===UL?UL:allowHtNS+20;
  const areaPerFA = Math.ceil(fa/faa);

  // §903.2 triggers (per fire area)
  const trig_areaM = occ==="M"   && areaPerFA>12000;
  const trig_areaA = ["A-1","A-2"].includes(occ) && areaPerFA>5000;
  const trig_ht    = ht>55;
  const trig_hr    = ht>75;
  const trig_R2    = occ==="R-2" && st>=4;
  const trig_S1    = occ==="S-1" && (st>=3||fa>100000);
  const sprReq = trig_areaM||trig_areaA||trig_ht||trig_hr||trig_R2||trig_S1;

  const areaPassNS = fa<=(allowNS===UL?9e8:allowNS);
  const areaPassSA = fa<=(allowSA===UL?9e8:allowSA);
  const stPassNS   = st<=(allowStNS===UL?999:allowStNS);
  const htPassNS   = ht<=(allowHtNS===UL?9999:allowHtNS);
  const htPassSA   = ht<=(allowHtSA===UL?9999:allowHtSA);

  const tdRow = TRAVEL_DIST[occ]||[200,250];
  const travelNS=tdRow[0], travelSA=tdRow[1];
  const travel = sprReq?travelSA:travelNS;
  const exits  = occupantLoad>(SINGLE_EXIT_MAX[occKey]||49)?2:1;
  const minDoor  = Math.max(36,Math.ceil(occupantLoad*0.15));
  const minStair = Math.max(36,Math.ceil(occupantLoad*0.20));
  const liveLoad = LIVE_LOADS[occ]||50;
  const commonPath = sprReq?100:75;
  const isHighRise = ht>75;
  const ch4Active  = isHighRise||["I-1","I-2","I-3","R-1","R-2"].includes(occ);
  const ch22Active = ["I-A","I-B","II-A","II-B"].includes(ct);
  const ch23Active = ["III-A","III-B","IV","V-A","V-B"].includes(ct);
  const corridorHr = sprReq?0:occupantLoad>30?1:0;

  // Find minimum CT that resolves without sprinklers
  let ctFix=null;
  for(const c of CT_ORDER.slice().reverse()){
    const a=(ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"])[c]||0;
    const s=(ALLOW_STORIES_NS[occ]||ALLOW_STORIES_NS["B"])[c]||0;
    const h=ALLOW_HT_NS[c]||0;
    if((a===UL||a>=fa)&&(s===UL||s>=st)&&(h===UL||h>=ht)) ctFix=c;
  }
  let ctWithSpr=null;
  for(const c of CT_ORDER.slice().reverse()){
    const a=(ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"])[c]||0;
    const s=(ALLOW_STORIES_NS[occ]||ALLOW_STORIES_NS["B"])[c]||0;
    const h=ALLOW_HT_NS[c]||0;
    const aSA=a===UL?UL:a*3, sSA=s===UL?UL:s+3, hSA=h===UL?UL:h+20;
    if((aSA===UL||aSA>=fa)&&(sSA===UL||sSA>=st)&&(hSA===UL||hSA>=ht)) ctWithSpr=c;
  }

  // CT area map for comparison table
  const ctAreaMap = CT_ORDER.map(c=>({
    ct:c,
    areaMax:(ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"])[c]||0,
    areaMaxSA:((ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"])[c]||0)===UL?UL:((ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"])[c]||0)*3,
    storiesMax:(ALLOW_STORIES_NS[occ]||ALLOW_STORIES_NS["B"])[c]||0,
    htMax:ALLOW_HT_NS[c]||0,
  }));

  // Quick alts (for circuit panel)
  const alts=[];
  if(sprReq){
    if(trig_areaM||trig_areaA){
      const threshold=occ==="M"?12000:5000;
      const areasNeeded=Math.ceil(fa/threshold);
      const worksNow=faa>=areasNeeded;
      alts.push({id:"firewall",label:"§706 Fire Wall Subdivision",short:`${faa} area${faa>1?"s":""} × ${areaPerFA.toLocaleString()} sf`,
        color:"#ffd700",works:worksNow,
        detail:worksNow?`✓ ${faa} fire areas eliminate §903.2 trigger`:`Need ${areasNeeded} areas (${Math.ceil(fa/areasNeeded).toLocaleString()} sf each)`,
        areasNeeded,wireLabel:worksNow?"ELIMINATES trigger":`need ${areasNeeded} areas`});
    }
    if(!trig_ht&&!trig_hr&&ctFix){
      alts.push({id:"upgradeCT",label:`Upgrade to ${ctFix}`,short:`${ctFix} = higher limits`,
        color:"#00cfff",works:true,detail:`${ctFix} allows area/stories without sprinklers`,wireLabel:`upgrade → ${ctFix}`});
    }
    alts.push({id:"nfpa13",label:"NFPA 13 Full Sprinklers",short:"§903 + §506.3 bonus",
      color:"#39ff14",works:true,
      detail:`Area ×3 → ${allowSA===UL?"Unlimited":allowSA.toLocaleString()} sf · travel +${travelSA-travelNS}ft`,wireLabel:`NFPA 13 → ×3`});
  }

  // Full alternatives (for alternatives panel) — detailed options
  const alternatives = {};
  if(sprReq){
    const trigLabels=[];
    if(trig_areaM) trigLabels.push(`§903.2.7 — Group M fire area ${areaPerFA.toLocaleString()} sf > 12,000 sf`);
    if(trig_areaA) trigLabels.push(`§903.2.1 — Assembly fire area ${areaPerFA.toLocaleString()} sf > 5,000 sf`);
    if(trig_ht)    trigLabels.push(`§903.2.6 — Height ${ht}ft > 55ft above lowest FD access`);
    if(trig_hr)    trigLabels.push(`§903.2.11.3 — High-rise building > 75ft`);
    if(trig_R2)    trigLabels.push(`§903.2.8 — Group R-2 with ${st} stories ≥ 4`);
    if(trig_S1)    trigLabels.push(`§903.2.9 — Group S-1 large/multi-story`);

    const threshold=occ==="M"?12000:5000;
    const areasNeeded=Math.ceil(fa/threshold);
    const fwWorks=faa>=areasNeeded && (trig_areaM||trig_areaA) && !trig_ht && !trig_hr && !trig_R2;

    alternatives.sprinkler={
      label:"NFPA 13 Sprinkler System Required",
      triggered_by:trigLabels,
      options:[
        {id:"spr_A",label:"Option A — Provide NFPA 13 Full Sprinkler System",icon:"✓",color:"#39ff14",type:"comply",
          result:"Requirement MET — §506.3 area ×3 · travel +"+( travelSA-travelNS)+"ft · height +20ft",
          conditions:["Full NFPA 13 throughout","Not NFPA 13R (residential only)","Licensed fire protection engineer"],
          tradeoff:`Cost ~$2–4/sf. Unlocks: area ×3 → ${allowSA===UL?"Unlimited":allowSA.toLocaleString()} sf, travel → ${travelSA}ft, height → ${allowHtSA===UL?"Unlimited":allowHtSA}ft`},
        {id:"spr_B",label:"Option B — Subdivide with 2-hr Fire Walls (§706)",icon:"◈",color:"#ffd700",type:"alternative",
          available:(trig_areaM||trig_areaA)&&!trig_ht&&!trig_hr&&!trig_R2,
          not_available:trig_ht||trig_hr||trig_R2,
          result:fwWorks?`✓ ${faa} fire areas × ${areaPerFA.toLocaleString()} sf — ELIMINATES §903.2 area trigger`
            :(trig_ht||trig_hr)?`✗ NOT AVAILABLE — height triggers cannot be subdivided`
            :`Need ${areasNeeded} fire areas — increase subdivisions`,
          conditions:["§706 fire wall — 2-hr rating minimum","Wall must extend to/through roof deck","Openings require rated assemblies per §716","Each fire area independent per Table 506.2"],
          tradeoff:`Works ONLY for area triggers. ${fwWorks?"Currently active — ELIMINATES sprinkler requirement.":"Increase fire area slider to "+areasNeeded+" areas."} Cannot resolve height or story triggers.`},
        {id:"spr_C",label:"Option C — Upgrade Construction Type",icon:"◈",color:"#00cfff",type:"alternative",
          available:!trig_ht&&!trig_hr&&!!ctFix,
          not_available:trig_ht||trig_hr,
          result:ctFix&&!trig_ht&&!trig_hr?`✓ Upgrade to ${CT_LABEL[ctFix]} — fits without sprinklers`
            :trig_ht||trig_hr?"✗ NOT AVAILABLE — height triggers remain regardless of CT"
            :"✗ No single CT resolves this without sprinklers",
          conditions:[ctFix?`Upgrade to ${CT_LABEL[ctFix]}`:"Combination with sprinklers needed","All structural elements meet Table 601 ratings","More expensive fire-rated assemblies"],
          tradeoff:"Works for area/story overages only. Does NOT resolve §903.2.6 (>55ft) or §903.2.11.3 (>75ft)."},
        {id:"spr_D",label:"Option D — Reduce Building Size",icon:"↓",color:"#ff6b35",type:"alternative",
          available:trig_areaM||trig_areaA,
          not_available:trig_ht||trig_hr,
          result:occ==="M"?`Reduce each fire area to ≤12,000 sf to eliminate §903.2.7`
            :`Reduce each fire area to ≤5,000 sf to eliminate §903.2.1`,
          conditions:["Structural redesign required","Reduces rentable/program area"],
          tradeoff:"Eliminates trigger at cost of building program."},
        {id:"spr_E",label:"Option E — NFPA 13R (Residential Only)",icon:"◈",color:"#bf7fff",type:"alternative",
          available:["R-1","R-2"].includes(occ)&&st<=4,
          not_available:!["R-1","R-2"].includes(occ),
          result:["R-1","R-2"].includes(occ)?`Permitted for ${occ} ≤4 stories — reduced scope vs full NFPA 13`
            :`✗ NOT AVAILABLE — NFPA 13R is residential only, not ${occ}`,
          conditions:["R-1 or R-2 occupancy only","Maximum 4 stories","Does NOT provide §506.3 area ×3 bonus"],
          tradeoff:"Lower cost than full NFPA 13. No area multiplier — only sprinkler compliance credit."},
      ]
    };
  }

  if(!areaPassNS){
    alternatives.area={
      label:`Floor Area ${fa.toLocaleString()} sf Exceeds ${ct} Limit (${allowNS===UL?"Unlimited":allowNS.toLocaleString()} sf)`,
      triggered_by:[`Table 506.2 — ${ct} allows ${allowNS===UL?"Unlimited":allowNS.toLocaleString()} sf/floor for ${occ}`],
      options:[
        {id:"ar_A",label:"Option A — NFPA 13 Sprinklers (§506.3 × 3 multiplier)",icon:"✓",color:"#39ff14",type:"comply",
          result:areaPassSA?`✓ RESOLVES — sprinklered limit ${allowSA===UL?"Unlimited":allowSA.toLocaleString()} sf ≥ ${fa.toLocaleString()} sf`
            :`✗ Insufficient — even ×3 = ${allowSA===UL?"Unlimited":allowSA.toLocaleString()} sf < ${fa.toLocaleString()} sf`,
          conditions:["Full NFPA 13 required (not 13R)","§506.3 — each Table 506.2 value multiplied by 3"],
          tradeoff:`${areaPassSA?"Resolves area issue. Also unlocks height and travel bonuses.":"Must also upgrade construction type."}`},
        {id:"ar_B",label:"Option B — Upgrade Construction Type",icon:"◈",color:"#00cfff",type:"alternative",
          result:ctFix?`✓ Upgrade to ${CT_LABEL[ctFix]} — allows ${(ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"])[ctFix]===UL?"Unlimited":((ALLOW_AREA_NS[occ]||ALLOW_AREA_NS["B"])[ctFix]||0).toLocaleString()} sf`
            :"✗ No single CT resolves — combine with sprinklers",
          conditions:[ctFix?`Needed: ${CT_LABEL[ctFix]}`:"Combination required","Full Table 601 structural ratings"],
          tradeoff:"Higher CT eliminates sprinkler need for area — but costs more structurally."},
        {id:"ar_C",label:"Option C — §706 Fire Walls (subdivide area)",icon:"◈",color:"#ffd700",type:"alternative",
          result:`Split into ${Math.ceil(fa/(allowNS===UL?999999:allowNS))} fire areas — each ≤${allowNS===UL?"Unlimited":allowNS.toLocaleString()} sf`,
          conditions:["§706 2-hr fire wall through roof","Each area independent per Table 506.2","Rated openings §716"],
          tradeoff:`Need ${Math.ceil(fa/(allowNS===UL?999999:allowNS))} fire areas. No sprinklers needed if each area fits CT limits.`},
      ]
    };
  }

  if(!htPassNS){
    alternatives.height={
      label:`Height ${ht}ft Exceeds ${ct} Limit (${allowHtNS===UL?"Unlimited":allowHtNS}ft)`,
      triggered_by:[`Table 504.4 — ${ct} allows ${allowHtNS===UL?"Unlimited":allowHtNS}ft for ${occ}`],
      options:[
        {id:"ht_A",label:"Option A — Add Sprinklers (+20ft bonus)",icon:"✓",color:"#39ff14",type:"comply",
          result:ht<=(allowHtSA===UL?9999:allowHtSA)?`✓ RESOLVES — sprinklered limit ${allowHtSA===UL?"Unlimited":allowHtSA}ft ≥ ${ht}ft`
            :`✗ Still insufficient — ${allowHtSA===UL?"Unlimited":allowHtSA}ft sprinklered limit exceeded`,
          conditions:["Full NFPA 13","§504.4 height increases when sprinklered"],
          tradeoff:`${ht<=(allowHtSA===UL?9999:allowHtSA)?"Resolves height issue + area/travel bonuses.":"Must also upgrade CT."}`},
        {id:"ht_B",label:"Option B — Upgrade to I-A or I-B",icon:"◈",color:"#00cfff",type:"alternative",
          result:`I-A = unlimited height · I-B = 160ft`,
          conditions:["Fully noncombustible structure","Table 601 maximum ratings","Highest construction cost"],
          tradeoff:"Most expensive option. Eliminates height limits for most occupancies."},
        {id:"ht_C",label:"Option C — Reduce Building Height",icon:"↓",color:"#ff6b35",type:"alternative",
          result:`Reduce to ≤${allowHtNS===UL?"Unlimited":allowHtNS}ft to comply with ${ct}`,
          conditions:["Structural redesign","Reduce floor count or floor-to-floor height"],
          tradeoff:"No code change — but reduces program."},
      ]
    };
  }

  // Node data for circuit
  const nodes={
    CH3:{label:"Ch 3",sub:"Occupancy",values:[`${occ}`,`÷${loadFactor} sf/pax`,`${occupantLoad} persons`],active:true,alert:false},
    CH4:{label:"Ch 4",sub:"Special Occ.",values:[isHighRise?"HIGH-RISE §403":"special occ",ch4Active?"ACTIVE":"dormant"],active:ch4Active,alert:isHighRise},
    CH5:{label:"Ch 5",sub:"Ht & Area",values:[
      `${fa.toLocaleString()}/${sprReq?(allowSA===UL?"∞":allowSA.toLocaleString()):(allowNS===UL?"∞":allowNS.toLocaleString())} sf ${(sprReq?areaPassSA:areaPassNS)?"✓":"✗"}`,
      `${st}/${sprReq?allowStSA:allowStNS} st ${stPassNS?"✓":"✗"}`,
      `${ht}ft/${sprReq?(allowHtSA===UL?"∞":allowHtSA):allowHtNS}ft ${(sprReq?htPassSA:htPassNS)?"✓":"✗"}`,
    ],active:true,alert:!areaPassNS||!stPassNS||!htPassNS},
    CH6:{label:"Ch 6",sub:"Const. Type",values:[ct,"Table 601"],active:true,alert:false},
    CH7:{label:"Ch 7",sub:"Fire Resist.",values:[`Corridor: ${corridorHr}hr`,mixed?"Table 508.4":"single occ."],active:true,alert:false},
    CH9:{label:"Ch 9",sub:"Sprinklers",values:sprReq?["NFPA 13 REQUIRED",
      trig_areaM?`§903.2.7: ${areaPerFA.toLocaleString()}sf/area`:"",
      trig_ht?`§903.2.6: ${ht}ft>55ft`:"",trig_hr?"§903.2.11: HR":"",
    ].filter(Boolean):["not triggered","watching..."],active:sprReq,alert:sprReq},
    CH10:{label:"Ch 10",sub:"Egress",values:[`${occupantLoad}pax → ${exits} exit${exits>1?"s":""}`,`door ≥${minDoor}" stair ≥${minStair}"`,`travel ≤${travel}ft`,`common ≤${commonPath}ft`],active:true,alert:false},
    CH11:{label:"Ch 11",sub:"Access.",values:["§1009 acc. egress","areas of rescue"],active:true,alert:false},
    CH16:{label:"Ch 16",sub:"Struct. Loads",values:[`${liveLoad} psf live`,"guard: 200lbs/50plf","ASCE 7"],active:true,alert:false},
    CH17:{label:"Ch 17",sub:"Sp. Insp.",values:["§1705.2 concrete","§1705.10 seismic","§1705.12 SFRM"],active:true,alert:ht>35},
    CH18:{label:"Ch 18",sub:"Foundations",values:[`${liveLoad}psf → ftg`,"§1806 soil"],active:true,alert:false},
    CH22:{label:"Ch 22",sub:"Steel",values:["AISC 360","ASCE 7 input"],active:ch22Active,alert:false},
    CH23:{label:"Ch 23",sub:"Wood",values:["AF&PA NDS","ASCE 7 input"],active:ch23Active,alert:false},
  };

  return {
    occ,ct,fa,ht,st,faa,occupantLoad,loadFactor,
    allowNS,allowSA,allowStNS,allowStSA,allowHtNS,allowHtSA,
    areaPerFA,trig_areaM,trig_areaA,trig_ht,trig_hr,trig_R2,trig_S1,sprReq,
    areaPassNS,areaPassSA,stPassNS,htPassNS,htPassSA,
    travel,travelNS,travelSA,exits,minDoor,minStair,liveLoad,commonPath,
    isHighRise,ch4Active,ch22Active,ch23Active,corridorHr,
    ctFix,ctWithSpr,ctAreaMap,alts,alternatives,nodes,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════
const NP={CH3:{x:160,y:340},CH4:{x:360,y:165},CH5:{x:555,y:340},CH6:{x:360,y:515},
  CH7:{x:750,y:165},CH9:{x:750,y:515},CH10:{x:940,y:340},CH11:{x:940,y:165},
  CH16:{x:555,y:600},CH17:{x:750,y:660},CH18:{x:360,y:680},CH22:{x:160,y:600},CH23:{x:160,y:500}};
const NM={CH3:{color:"#39ff14"},CH4:{color:"#ff6b35"},CH5:{color:"#00cfff"},CH6:{color:"#ffd700"},
  CH7:{color:"#ff4444"},CH9:{color:"#ff4444"},CH10:{color:"#39ff14"},CH11:{color:"#bf7fff"},
  CH16:{color:"#00cfff"},CH17:{color:"#ff6b35"},CH18:{color:"#888"},CH22:{color:"#888"},CH23:{color:"#888"}};

const WIRE_DEFS=[
  {id:"w1",from:"CH3",to:"CH5",type:"signal",getLabel:c=>`${c.occ} row T504/506`,getActive:()=>true,getAlert:()=>false},
  {id:"w2",from:"CH3",to:"CH6",type:"signal",getLabel:()=>`constrains type`,getActive:()=>true,getAlert:()=>false},
  {id:"w3",from:"CH3",to:"CH10",type:"signal",getLabel:c=>`÷${c.loadFactor}=${c.occupantLoad}pax`,getActive:()=>true,getAlert:()=>false},
  {id:"w4",from:"CH3",to:"CH16",type:"signal",getLabel:c=>`${c.liveLoad}psf T1607`,getActive:()=>true,getAlert:()=>false},
  {id:"w5",from:"CH3",to:"CH9",type:"trigger",getLabel:c=>c.sprReq?"§903.2 FIRES!":"§903.2 watching",getActive:()=>true,getAlert:c=>c.sprReq},
  {id:"w6",from:"CH6",to:"CH5",type:"signal",getLabel:c=>`${c.ct} col T506`,getActive:()=>true,getAlert:()=>false},
  {id:"w7",from:"CH6",to:"CH7",type:"signal",getLabel:()=>"Table 601 ratings",getActive:()=>true,getAlert:()=>false},
  {id:"w8",from:"CH6",to:"CH22",type:"signal",getLabel:c=>c.ch22Active?"→ steel noncomb.":"steel N/A",getActive:c=>c.ch22Active,getAlert:()=>false},
  {id:"w9",from:"CH6",to:"CH23",type:"signal",getLabel:c=>c.ch23Active?"→ wood allowed":"wood N/A",getActive:c=>c.ch23Active,getAlert:()=>false},
  {id:"w10",from:"CH5",to:"CH9",type:"trigger",getLabel:c=>!c.areaPassNS?`${c.fa.toLocaleString()}>${c.allowNS===UL?"∞":c.allowNS.toLocaleString()} FIRES`:"area ok",getActive:()=>true,getAlert:c=>!c.areaPassNS},
  {id:"w11",from:"CH9",to:"CH5",type:"credit",getLabel:c=>c.sprReq?`§506.3 ×3=${c.allowSA===UL?"∞":c.allowSA.toLocaleString()}sf`:"no credit",getActive:c=>c.sprReq,getAlert:()=>false},
  {id:"w12",from:"CH9",to:"CH10",type:"credit",getLabel:c=>c.sprReq?`+${c.travelSA-c.travelNS}ft → ${c.travelSA}ft`:"no credit",getActive:c=>c.sprReq,getAlert:()=>false},
  {id:"w13",from:"CH10",to:"CH9",type:"trigger",getLabel:c=>c.occupantLoad>300?`${c.occupantLoad}>300 fires`:`${c.occupantLoad}pax`,getActive:()=>true,getAlert:c=>c.occupantLoad>300},
  {id:"w14",from:"CH7",to:"CH10",type:"signal",getLabel:c=>`corridor ${c.corridorHr}hr`,getActive:()=>true,getAlert:()=>false},
  {id:"w15",from:"CH10",to:"CH7",type:"signal",getLabel:c=>`exit ${c.exits>1?"2":"1"} rated`,getActive:()=>true,getAlert:()=>false},
  {id:"w16",from:"CH4",to:"CH7",type:"signal",getLabel:c=>c.ch4Active?"compartmentation":"n/a",getActive:c=>c.ch4Active,getAlert:()=>false},
  {id:"w17",from:"CH4",to:"CH9",type:"trigger",getLabel:c=>c.isHighRise?"§403 FIRES":"n/a",getActive:c=>c.isHighRise,getAlert:c=>c.isHighRise},
  {id:"w18",from:"CH4",to:"CH10",type:"signal",getLabel:c=>c.ch4Active?"§407 override":"n/a",getActive:c=>c.ch4Active,getAlert:()=>false},
  {id:"w19",from:"CH11",to:"CH10",type:"signal",getLabel:()=>"§1009 acc. egress",getActive:()=>true,getAlert:()=>false},
  {id:"w20",from:"CH16",to:"CH18",type:"signal",getLabel:c=>`${c.liveLoad}psf → ftg`,getActive:()=>true,getAlert:()=>false},
  {id:"w21",from:"CH16",to:"CH22",type:"signal",getLabel:()=>"ASCE7 → steel",getActive:c=>c.ch22Active,getAlert:()=>false},
  {id:"w22",from:"CH16",to:"CH23",type:"signal",getLabel:()=>"ASCE7 → wood",getActive:c=>c.ch23Active,getAlert:()=>false},
  {id:"w23",from:"CH17",to:"CH16",type:"trigger",getLabel:c=>c.ht>35?"SDC →§1705.10":"low SDC",getActive:()=>true,getAlert:c=>c.ht>35},
];

function wirePath(wid){
  const w=WIRE_DEFS.find(x=>x.id===wid); if(!w)return"";
  const f=NP[w.from],t=NP[w.to];
  const cx1=f.x+(t.x-f.x)*0.35,cy1=f.y,cx2=t.x-(t.x-f.x)*0.35,cy2=t.y;
  return `M${f.x},${f.y} C${cx1},${cy1} ${cx2},${cy2} ${t.x},${t.y}`;
}
function wireMid(wid){
  const w=WIRE_DEFS.find(x=>x.id===wid); if(!w)return{x:0,y:0};
  return{x:(NP[w.from].x+NP[w.to].x)/2,y:(NP[w.from].y+NP[w.to].y)/2};
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [inp, setInp] = useState({occupancy:"M",constType:"V-B",stories:1,floorArea:8000,heightFt:20,fireAreas:1,mixed:false});
  const [view, setView] = useState("circuit"); // "circuit" | "alternatives"
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverWire, setHoverWire] = useState(null);
  const [flashNodes, setFlashNodes] = useState(new Set());
  const [pulseWires, setPulseWires] = useState(new Set());
  const [activeAlt, setActiveAlt] = useState(null);
  const [expandedOpt, setExpandedOpt] = useState(null);
  const [selectedOpts, setSelectedOpts] = useState({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0, y:0});
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({x:0,y:0,px:0,py:0});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canvasRef = useRef(null);
  const prevCalcRef = useRef(null);

  const calc = useMemo(()=>compute(inp),[inp]);
  const set=(k,v)=>setInp(p=>({...p,[k]:v}));
  const anyTrigger = Object.keys(calc.alternatives).length>0;

  useEffect(()=>{
    if(!prevCalcRef.current){prevCalcRef.current=calc;return;}
    const prev=prevCalcRef.current;
    const changed=new Set();
    Object.keys(calc.nodes).forEach(id=>{
      if(JSON.stringify(calc.nodes[id]?.values)!==JSON.stringify(prev.nodes[id]?.values)) changed.add(id);
    });
    if(changed.size){
      setFlashNodes(changed);
      const pw=new Set(WIRE_DEFS.filter(w=>changed.has(w.from)).map(w=>w.id));
      setPulseWires(pw);
      setTimeout(()=>{setFlashNodes(new Set());setPulseWires(new Set());},1400);
    }
    prevCalcRef.current=calc;
  },[inp]);

  function applyAlt(alt){
    if(activeAlt===alt.id){setActiveAlt(null);return;}
    setActiveAlt(alt.id);
    if(alt.id==="firewall"&&alt.areasNeeded) set("fireAreas",alt.areasNeeded);
    else if(alt.id==="upgradeCT"&&calc.ctFix) set("constType",calc.ctFix);
  }
  function toggleOpt(reqId,optId){
    setSelectedOpts(p=>({...p,[reqId]:p[reqId]===optId?null:optId}));
  }

  const wCol=(type,active,alert)=>{
    if(!active)return"#141e14";
    if(alert)return type==="credit"?"#00cfff":"#ff4444";
    return type==="credit"?"#00cfff":type==="trigger"?"#ff9900":"#39ff14";
  };
  const wArr=(type,active,alert)=>{
    if(!active)return"url(#a-dim)";
    if(alert)return"url(#a-red)";
    return type==="credit"?"url(#a-blue)":type==="trigger"?"url(#a-orange)":"url(#a-green)";
  };

  // ── SHARED LEFT INPUT PANEL ─────────────────────────────────────────────────
  const InputPanel = (
    <div style={{width:252,flexShrink:0,borderRight:"1px solid #39ff1418",overflowY:"auto",background:"#040a04",padding:"14px 14px"}}>
      <Lbl>◈ INPUTS</Lbl>
      <IG label="Q2 Occupancy" sec="§302.1">
        <select value={inp.occupancy} onChange={e=>{set("occupancy",e.target.value);setActiveAlt(null);setSelectedOpts({});}} style={SS}>
          {OCCS.map(o=><option key={o} value={o}>{o} — {OCC_LABELS[o]}</option>)}
        </select>
        <Chp color="#8888ff">Factor: {OCC_LOAD_FACTORS[inp.occupancy]||100} sf/pax → {calc.occupantLoad} pax</Chp>
      </IG>
      <IG label="Q4 Floor Area" sec="Table 506.2 / 1004.5">
        <RR value={inp.floorArea} min={500} max={80000} step={500} color="#00cfff" fmt={v=>v.toLocaleString()+" sf"} onChange={v=>set("floorArea",v)}/>
        <Chp color={calc.areaPassNS?"#39ff14":"#ff4444"}>Limit NS: {calc.allowNS===UL?"Unlimited":calc.allowNS.toLocaleString()} sf</Chp>
        {calc.sprReq&&<Chp color="#00cfff">×3 SA: {calc.allowSA===UL?"Unlimited":calc.allowSA.toLocaleString()} sf</Chp>}
      </IG>
      <IG label="Q5 Height" sec="Table 504.4 / §903.2">
        <RR value={inp.heightFt} min={10} max={300} step={5} color="#ffd700" fmt={v=>v+"ft"} onChange={v=>set("heightFt",v)}/>
        <Chp color={inp.heightFt>75?"#ff4444":inp.heightFt>55?"#ffd700":"#39ff14"}>
          {inp.heightFt>75?"HIGH-RISE >75ft":inp.heightFt>55?">55ft §903.2.6":"below triggers"}
        </Chp>
      </IG>
      <IG label="Q3 Stories" sec="Table 504.3">
        <RR value={inp.stories} min={1} max={15} step={1} color="#ff6b35" fmt={v=>v+" stories"} onChange={v=>set("stories",v)}/>
      </IG>
      <IG label="Q6 Const. Type" sec="Table 601">
        <select value={inp.constType} onChange={e=>{set("constType",e.target.value);setActiveAlt(null);}} style={SS}>
          {CT_ORDER.map(c=><option key={c} value={c}>{CT_LABEL[c]}</option>)}
        </select>
      </IG>
      <IG label="Q7 Mixed Occ?" sec="§508 / Table 508.4">
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          {[false,true].map(v=>(
            <button key={String(v)} onClick={()=>set("mixed",v)} style={{
              flex:1,padding:"5px 0",borderRadius:3,cursor:"pointer",fontSize:10,
              fontFamily:"'Courier New',monospace",letterSpacing:"0.08em",
              background:inp.mixed===v?"#39ff1415":"transparent",
              border:`1px solid ${inp.mixed===v?"#39ff1455":"#39ff1422"}`,
              color:inp.mixed===v?"#39ff14":"#39ff1444",
            }}>{v?"YES":"NO"}</button>
          ))}
        </div>
        {inp.mixed&&<Chp color="#ff6b35">Table 508.4 separations active</Chp>}
      </IG>
      <div style={{borderTop:"1px solid #39ff1415",paddingTop:12,marginTop:4}}>
        <Lbl>◈ DESIGN OPTIONS</Lbl>
        <IG label="§706 Fire Wall Areas" sec="Subdivide to reduce fire area size">
          <RR value={inp.fireAreas} min={1} max={8} step={1} color="#ffd700" fmt={v=>v+" area"+(v>1?"s":"")} onChange={v=>{set("fireAreas",v);setActiveAlt(null);}}/>
          {inp.fireAreas>1&&(
            <Chp color={calc.alts.find(a=>a.id==="firewall")?.works?"#39ff14":"#ff4444"}>
              {calc.areaPerFA.toLocaleString()} sf/area · {calc.alts.find(a=>a.id==="firewall")?.works?"ELIMINATES trigger":"still triggers"}
            </Chp>
          )}
        </IG>
      </div>
      {/* Threshold bars */}
      <div style={{borderTop:"1px solid #39ff1415",paddingTop:12,marginTop:4}}>
        <Lbl>◈ THRESHOLD METERS</Lbl>
        {[
          {label:"Area / NS Limit",v:calc.fa,max:calc.allowNS===UL?calc.fa:calc.allowNS,pass:calc.areaPassNS,fmt:v=>v.toLocaleString()},
          {label:"Height / 55ft §903.2.6",v:calc.ht,max:55,pass:calc.ht<=55,fmt:v=>v+"ft"},
          {label:"Occ. / Single-exit max",v:calc.occupantLoad,max:SINGLE_EXIT_MAX[calc.occ.split("-")[0]]||49,pass:calc.exits===1,fmt:v=>v+" pax"},
          {label:"Stories / NS Limit",v:calc.st,max:calc.allowStNS===UL?calc.st:calc.allowStNS,pass:calc.stPassNS,fmt:v=>v+" st"},
        ].map(m=>(
          <div key={m.label} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#39ff1044",marginBottom:2}}>
              <span>{m.label}</span>
              <span style={{color:m.pass?"#39ff14":"#ff4444"}}>{m.fmt(m.v)}/{m.fmt(m.max)}</span>
            </div>
            <div style={{height:5,background:"#0a150a",borderRadius:2,overflow:"hidden",border:"1px solid #39ff1420"}}>
              <div style={{height:"100%",borderRadius:2,transition:"width .4s,background .4s",
                width:`${Math.min(100,(m.v/(m.max||1))*100)}%`,
                background:m.pass?"#39ff14":m.v/(m.max||1)>1.2?"#ff4444":"#ffd700",
                boxShadow:`0 0 4px ${m.pass?"#39ff14":m.v/(m.max||1)>1.2?"#ff4444":"#ffd700"}`}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── ZOOM/PAN HANDLERS ───────────────────────────────────────────────────────
  function handleWheel(e){
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(3, Math.max(0.3, z * delta)));
  }
  function handleMouseDown(e){
    if(e.button!==0) return;
    setDragging(true);
    setDragStart({x:e.clientX, y:e.clientY, px:pan.x, py:pan.y});
  }
  function handleMouseMove(e){
    if(!dragging) return;
    setPan({x: dragStart.px + (e.clientX - dragStart.x), y: dragStart.py + (e.clientY - dragStart.y)});
  }
  function handleMouseUp(){ setDragging(false); }
  function fitToScreen(){
    setZoom(1); setPan({x:0, y:0});
  }

  // ── CIRCUIT VIEW ────────────────────────────────────────────────────────────
  const CircuitView = (
    <div style={{flex:1,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      {/* Zoom controls toolbar */}
      <div style={{
        position:"absolute",top:12,right:12,zIndex:30,
        display:"flex",flexDirection:"column",gap:5,
      }}>
        {[
          {label:"+", action:()=>setZoom(z=>Math.min(3,z*1.2))},
          {label:"−", action:()=>setZoom(z=>Math.max(0.3,z/1.2))},
          {label:"⊡", action:fitToScreen},
        ].map(b=>(
          <button key={b.label} onClick={b.action} style={{
            width:30, height:30, borderRadius:5, border:"1px solid #39ff1433",
            background:"#040a04cc", color:"#39ff14", fontSize:16,
            fontFamily:"'Courier New',monospace", cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
            backdropFilter:"blur(4px)",
            boxShadow:"0 0 8px #39ff1422",
          }}>{b.label}</button>
        ))}
        <div style={{
          padding:"4px 6px", borderRadius:4, border:"1px solid #39ff1422",
          background:"#040a04cc", color:"#39ff1088", fontSize:9,
          fontFamily:"'Courier New',monospace", textAlign:"center",
          backdropFilter:"blur(4px)",
        }}>{Math.round(zoom*100)}%</div>
      </div>

      {/* Hint */}
      <div style={{
        position:"absolute",bottom:drawerOpen?210:12,left:"50%",transform:"translateX(-50%)",
        zIndex:30,fontSize:9,color:"#39ff1033",letterSpacing:"0.1em",
        pointerEvents:"none",transition:"bottom .3s",
      }}>SCROLL TO ZOOM · DRAG TO PAN</div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          flex:1,
          cursor: dragging ? "grabbing" : "grab",
          position:"relative",
          overflow:"hidden",
          userSelect:"none",
        }}
      >
        <div style={{
          position:"absolute",
          left:"50%", top:"50%",
          transform:`translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin:"center center",
          transition: dragging ? "none" : "transform .05s",
          width:1100, height:760,
        }}>
      <svg viewBox="0 0 1100 760" width={1100} height={760} style={{display:"block"}}>
        <defs>
          {[["green","#39ff14"],["red","#ff4444"],["blue","#00cfff"],["orange","#ff9900"],["dim","#141e14"]].map(([n,c])=>(
            <marker key={n} id={`a-${n}`} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,.5 L6,3.5 L0,6.5 Z" fill={c}/>
            </marker>
          ))}
          {[["gg","#39ff14"],["gr","#ff4444"],["gb","#00cfff"],["go","#ff9900"]].map(([id,c])=>(
            <filter key={id} id={id}><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          ))}
        </defs>
        {[165,340,515,600,680].map(y=><line key={y} x1={60} y1={y} x2={1040} y2={y} stroke="#39ff1407" strokeWidth={1}/>)}
        {[160,360,555,750,940].map(x=><line key={x} x1={x} y1={50} x2={x} y2={710} stroke="#39ff1407" strokeWidth={1}/>)}

        {/* WIRES */}
        {WIRE_DEFS.map(wd=>{
          const isActive=wd.getActive(calc), isAlert=wd.getAlert(calc);
          const col=wCol(wd.type,isActive,isAlert);
          const path=wirePath(wd.id), mp=wireMid(wd.id);
          const isHov=hoverWire===wd.id, isPulse=pulseWires.has(wd.id);
          const gid=isAlert?"gr":wd.type==="credit"?"gb":"gg";
          return(
            <g key={wd.id} onMouseEnter={()=>setHoverWire(wd.id)} onMouseLeave={()=>setHoverWire(null)}>
              {isActive&&<path d={path} fill="none" stroke={col} strokeWidth={isPulse?7:5} strokeOpacity={0.1} filter={`url(#${gid})`}/>}
              <path d={path} fill="none" stroke={isActive?col:"#0e160e"}
                strokeWidth={isHov?2.5:isActive?1.6:1} strokeDasharray={isActive?undefined:"5,5"}
                markerEnd={wArr(wd.type,isActive,isAlert)} style={{transition:"stroke .3s"}}/>
              {isActive&&isPulse&&(
                <circle r={5} fill={col} opacity={0.9} style={{filter:`drop-shadow(0 0 6px ${col})`}}>
                  <animateMotion dur="0.7s" repeatCount="2" path={path}/>
                </circle>
              )}
              {isActive&&(
                <g opacity={isHov?1:0.75}>
                  <rect x={mp.x-52} y={mp.y-10} width={104} height={14} rx={3}
                    fill="#040a04cc" stroke={col} strokeWidth={0.5} strokeOpacity={isAlert?0.9:0.4}/>
                  <text x={mp.x} y={mp.y+1} textAnchor="middle" fill={col} fontSize={8}
                    fontFamily="'Courier New',monospace" fontWeight={isAlert?"bold":"normal"}>
                    {wd.getLabel(calc)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* NODES */}
        {Object.entries(NP).map(([id,pos])=>{
          const nd=calc.nodes[id]; if(!nd)return null;
          const meta=NM[id], isOn=nd.active, isAlt=nd.alert;
          const isHov=hoverNode===id, isFlash=flashNodes.has(id);
          const col=isAlt?"#ff4444":isOn?meta.color:"#1e2a1e";
          const bg=isAlt?"#1a0404":isOn?"#061006":"#040a04";
          const W=82,H=54;
          return(
            <g key={id} onMouseEnter={()=>setHoverNode(id)} onMouseLeave={()=>setHoverNode(null)}>
              {isFlash&&<rect x={pos.x-W/2-8} y={pos.y-H/2-8} width={W+16} height={H+16} rx={9} fill={col} opacity={0.08}
                style={{animation:"flash 1.4s ease-out"}}/>}
              {isOn&&<rect x={pos.x-W/2-3} y={pos.y-H/2-3} width={W+6} height={H+6} rx={7} fill={col} opacity={0.04}
                filter={`url(#${isAlt?"gr":meta.color==="#39ff14"?"gg":meta.color==="#00cfff"?"gb":"go"})`}/>}
              <rect x={pos.x-W/2} y={pos.y-H/2} width={W} height={H} rx={5} fill={bg}
                stroke={isHov?col:isOn?col+"88":col+"22"} strokeWidth={isHov?1.5:1} style={{transition:"all .25s"}}/>
              <path d={`M${pos.x-9},${pos.y-H/2} A9,9 0 0,0 ${pos.x+9},${pos.y-H/2}`}
                fill={bg} stroke={isOn?col+"55":"#1e2a1e"} strokeWidth={1}/>
              <circle cx={pos.x} cy={pos.y-H/2-7} r={5} fill={col}
                style={{filter:isOn?`drop-shadow(0 0 4px ${col}) drop-shadow(0 0 10px ${col}66)`:"none",transition:"all .3s"}}/>
              <text x={pos.x} y={pos.y-9} textAnchor="middle" fill={isOn?col:col+"44"}
                fontSize={12} fontWeight="bold" fontFamily="'Courier New',monospace">{nd.label}</text>
              <text x={pos.x} y={pos.y+5} textAnchor="middle" fill={isOn?col+"88":col+"22"}
                fontSize={7.5} fontFamily="'Courier New',monospace">{nd.sub}</text>
              <text x={pos.x} y={pos.y+18} textAnchor="middle"
                fill={isOn?(isAlt?"#ff4444":"#39ff1055"):col+"22"} fontSize={7} fontFamily="'Courier New',monospace">
                {isAlt?"⚠ ALERT":isOn?"● ON":"○ OFF"}
              </text>
              {[-24,-8,8,24].map((px,i)=>(
                <rect key={i} x={pos.x+px-4} y={pos.y+H/2} width={8} height={7} rx={1}
                  fill={isOn?col+"33":"#0d150d"} stroke={isOn?col+"55":"#1e2a1e"} strokeWidth={0.5}/>
              ))}
              {isHov&&nd.values&&(()=>{
                const px=pos.x>750?pos.x-W/2-162:pos.x+W/2+8, py=pos.y-50;
                return(<>
                  <rect x={px} y={py} width={155} height={nd.values.length*15+22} rx={4}
                    fill="#040a04" stroke={col} strokeWidth={0.8} strokeOpacity={0.7}/>
                  <text x={px+9} y={py+14} fill={col} fontSize={9} fontFamily="'Courier New',monospace" fontWeight="bold">
                    {nd.label} — {nd.sub}</text>
                  {nd.values.map((v,i)=>(
                    <text key={i} x={px+9} y={py+14+14*(i+1)} fill={col+"cc"} fontSize={8.5}
                      fontFamily="'Courier New',monospace">{v}</text>
                  ))}
                </>);
              })()}
            </g>
          );
        })}

        {/* Sprinkler badge */}
        <g>
          <rect x={462} y={318} width={146} height={42} rx={5}
            fill={calc.sprReq?"#1a0404":"#040d04"} stroke={calc.sprReq?"#ff4444":"#39ff1433"} strokeWidth={1}/>
          <text x={535} y={332} textAnchor="middle" fill={calc.sprReq?"#ff444488":"#39ff1044"}
            fontSize={8} fontFamily="'Courier New',monospace" letterSpacing="0.1em">NFPA 13 SPRINKLERS</text>
          <text x={535} y={348} textAnchor="middle" fill={calc.sprReq?"#ff4444":"#39ff1066"}
            fontSize={11} fontWeight="bold" fontFamily="'Courier New',monospace">
            {calc.sprReq?"■ REQUIRED":"□ not triggered"}
          </text>
        </g>
        <g opacity={0.4}>
          <rect x={468} y={400} width={134} height={13} rx={2} fill="#040a04" stroke="#ffd70022" strokeWidth={1}/>
          <text x={535} y={410} textAnchor="middle" fill="#ffd70055" fontSize={7} fontFamily="'Courier New',monospace">
            §506.3 ↔ §903.2 FEEDBACK LOOP
          </text>
        </g>
        <g>
          <rect x={18} y={18} width={155} height={26} rx={4} fill="#040a04" stroke="#39ff1422" strokeWidth={1}/>
          <text x={28} y={29} fill="#39ff1055" fontSize={7.5} fontFamily="'Courier New',monospace" letterSpacing="0.1em">LIVE WIRES / STATUS</text>
          <text x={28} y={40} fill="#39ff14" fontSize={10} fontFamily="'Courier New',monospace" fontWeight="bold">
            {WIRE_DEFS.filter(w=>w.getActive(calc)).length} wires · {WIRE_DEFS.filter(w=>w.getAlert(calc)).length} alerts
          </text>
        </g>
      </svg>
        </div>{/* end transform div */}
      </div>{/* end canvas */}

      {/* ── BOTTOM DRAWER ── */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0,
        zIndex:40,
        transition:"transform .3s ease",
        transform: drawerOpen ? "translateY(0)" : "translateY(calc(100% - 40px))",
      }}>
        {/* Drawer handle / tab strip */}
        <div
          onClick={()=>setDrawerOpen(o=>!o)}
          style={{
            height:40, background:"#040a04",
            borderTop:"1px solid #39ff1433",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"0 16px", cursor:"pointer",
          }}
        >
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <span style={{fontSize:10,color:"#39ff1088",letterSpacing:"0.12em"}}>
              ◈ LIVE OUTPUTS & ALTERNATIVES
            </span>
            {/* live pills */}
            <span style={{fontSize:9,color:"#39ff14",background:"#39ff1415",border:"1px solid #39ff1433",
              padding:"1px 7px",borderRadius:3}}>{calc.occupantLoad} pax</span>
            <span style={{fontSize:9,color:calc.exits>1?"#ffd700":"#39ff14",
              background:calc.exits>1?"#ffd70015":"#39ff1415",
              border:`1px solid ${calc.exits>1?"#ffd70033":"#39ff1433"}`,
              padding:"1px 7px",borderRadius:3}}>{calc.exits} exit{calc.exits>1?"s":""}</span>
            <span style={{fontSize:9,
              color:calc.sprReq?"#ff4444":"#39ff14",
              background:calc.sprReq?"#ff444415":"#39ff1415",
              border:`1px solid ${calc.sprReq?"#ff444433":"#39ff1433"}`,
              padding:"1px 7px",borderRadius:3}}>
              {calc.sprReq?"SPRINKLER REQ.":"no sprinkler triggers"}
            </span>
          </div>
          <span style={{fontSize:14,color:"#39ff1055"}}>{drawerOpen?"▼":"▲"}</span>
        </div>

        {/* Drawer body */}
        <div style={{
          background:"#040a04f5",
          borderTop:"1px solid #39ff1418",
          height:190, overflow:"hidden",
          backdropFilter:"blur(6px)",
        }}>
          <div style={{display:"flex",height:"100%"}}>
            {/* Code outputs */}
            <div style={{width:220,flexShrink:0,borderRight:"1px solid #39ff1418",
              overflowY:"auto",padding:"10px 12px",fontSize:10}}>
              <Lbl>CODE OUTPUTS</Lbl>
              {[
                {l:"Occupant load",v:`${calc.occupantLoad} pax`,c:"#39ff14"},
                {l:"Exits required",v:`${calc.exits}`,c:calc.exits>1?"#ffd700":"#39ff14"},
                {l:"Door width",v:`≥${calc.minDoor}"`,c:"#39ff14"},
                {l:"Stair width",v:`≥${calc.minStair}"`,c:"#39ff14"},
                {l:"Travel max",v:`${calc.travel}ft`,c:"#8888ff"},
                {l:"Common path",v:`${calc.commonPath}ft`,c:"#8888ff"},
                {l:"Corridor",v:`${calc.corridorHr}hr`,c:"#ff6b35"},
                {l:"Live load",v:`${calc.liveLoad} psf`,c:"#00cfff"},
                {l:"§506.3 bonus",v:calc.sprReq?"×3":"none",c:calc.sprReq?"#39ff14":"#444"},
                {l:"Ht bonus",v:calc.sprReq&&calc.allowHtNS!==UL?`+20→${calc.allowHtSA}ft`:"—",c:"#00cfff"},
              ].map(r=>(
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",
                  marginBottom:3,paddingBottom:2,borderBottom:"1px solid #39ff1410"}}>
                  <span style={{color:"#39ff1044",fontSize:9}}>{r.l}</span>
                  <span style={{color:r.c,fontWeight:"bold",fontSize:9,
                    textShadow:`0 0 5px ${r.c}44`,flexShrink:0}}>{r.v}</span>
                </div>
              ))}
            </div>

            {/* Alternatives */}
            <div style={{flex:1,overflowY:"auto",padding:"10px 12px",fontSize:10}}>
              <Lbl>ALTERNATIVES TO SPRINKLERS</Lbl>
              {calc.alts.length===0?(
                <div style={{padding:"8px",background:"#061006",border:"1px solid #39ff1422",
                  borderRadius:4,textAlign:"center"}}>
                  <span style={{fontSize:10,color:"#39ff14"}}>✓ No sprinkler triggers — circuit is clean</span>
                </div>
              ):(
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {calc.alts.map(alt=>(
                    <div key={alt.id} onClick={()=>applyAlt(alt)} style={{
                      flex:"1 1 180px", padding:"9px 10px", borderRadius:5, cursor:"pointer",
                      background:activeAlt===alt.id?alt.color+"18":"#0a140a",
                      border:`1.5px solid ${activeAlt===alt.id?alt.color:alt.color+"33"}`,
                      transition:"all .2s", minWidth:160,
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:10,fontWeight:"bold",color:alt.color,lineHeight:1.2}}>{alt.label}</span>
                        <div style={{width:9,height:9,borderRadius:"50%",flexShrink:0,
                          background:activeAlt===alt.id?alt.color:"transparent",
                          border:`1.5px solid ${alt.color}`,transition:"all .2s"}}/>
                      </div>
                      <div style={{fontSize:9,color:alt.works?"#39ff14":"#ff4444",lineHeight:1.4}}>{alt.detail}</div>
                      {activeAlt===alt.id&&(
                        <div style={{marginTop:5,fontSize:8,color:"#39ff14",padding:"2px 5px",
                          background:"#39ff1410",border:"1px solid #39ff1430",borderRadius:2}}>
                          ▸ APPLIED — circuit updated
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wire legend */}
            <div style={{width:130,flexShrink:0,borderLeft:"1px solid #39ff1418",
              padding:"10px 10px",fontSize:9}}>
              <Lbl>WIRE LEGEND</Lbl>
              {[
                {c:"#39ff14",l:"Signal"},
                {c:"#ff9900",l:"Trigger"},
                {c:"#ff4444",l:"Alert"},
                {c:"#00cfff",l:"Credit"},
              ].map(x=>(
                <div key={x.l} style={{display:"flex",gap:7,alignItems:"center",marginBottom:7}}>
                  <div style={{width:18,height:2,background:x.c,
                    boxShadow:`0 0 4px ${x.c}`,flexShrink:0}}/>
                  <span style={{color:x.c+"88"}}>{x.l}</span>
                </div>
              ))}
              <div style={{marginTop:10,borderTop:"1px solid #39ff1415",paddingTop:8}}>
                <Lbl>INTERACTIONS</Lbl>
                <div style={{color:"#39ff1044",lineHeight:1.6}}>
                  Scroll — zoom<br/>
                  Drag — pan<br/>
                  ⊡ — fit view<br/>
                  Hover — details
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>{/* end drawer */}
    </div>
  );

  // ── ALTERNATIVES VIEW ───────────────────────────────────────────────────────
  const AlternativesView = (
    <div style={{flex:1,overflowY:"auto",padding:"18px 20px"}}>
      {/* Status bar */}
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        {[
          {label:"SPRINKLERS",val:calc.sprReq?"REQUIRED":"not triggered",color:calc.sprReq?"#ff4444":"#39ff14"},
          {label:"AREA",val:calc.areaPassNS?"PASS":"EXCEEDS",color:calc.areaPassNS?"#39ff14":"#ff4444"},
          {label:"HEIGHT",val:calc.htPassNS?"PASS":"EXCEEDS",color:calc.htPassNS?"#39ff14":"#ff4444"},
          {label:"STORIES",val:calc.stPassNS?"PASS":"EXCEEDS",color:calc.stPassNS?"#39ff14":"#ff4444"},
          {label:"OCC. LOAD",val:`${calc.occupantLoad} pax`,color:"#00cfff"},
          {label:"EXITS",val:`${calc.exits} req.`,color:calc.exits>1?"#ffd700":"#39ff14"},
          {label:"TRAVEL",val:`${calc.travel}ft max`,color:"#8888ff"},
        ].map(s=>(
          <div key={s.label} style={{padding:"7px 12px",borderRadius:4,background:"#0e0e18",
            border:`1px solid ${s.color}33`,textAlign:"center",minWidth:90}}>
            <div style={{fontSize:8,color:"#666680",letterSpacing:"0.08em",marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:11,fontWeight:"bold",color:s.color,textShadow:`0 0 6px ${s.color}44`}}>{s.val}</div>
          </div>
        ))}
      </div>

      {!anyTrigger&&(
        <div style={{background:"#061006",border:"2px solid #39ff1422",borderRadius:8,padding:"28px",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:10}}>✓</div>
          <div style={{fontSize:14,color:"#39ff14",fontWeight:"bold",marginBottom:5}}>All requirements satisfied</div>
          <div style={{fontSize:11,color:"#39ff1055"}}>Increase area past {calc.allowNS===UL?"the unlimited limit":calc.allowNS.toLocaleString()+" sf"}, height past 55ft, or stories to trigger requirements and see alternatives.</div>
        </div>
      )}

      {Object.entries(calc.alternatives).map(([reqId,req])=>(
        <div key={reqId} style={{marginBottom:20}}>
          <div style={{background:"#180808",border:"1px solid #ff444333",borderLeft:"4px solid #ff4444",
            borderRadius:6,padding:"11px 14px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
              <span style={{fontSize:16,flexShrink:0}}>⚡</span>
              <div>
                <div style={{fontSize:12,fontWeight:"bold",color:"#ff4444",marginBottom:3}}>{req.label}</div>
                {req.triggered_by.map((t,i)=><div key={i} style={{fontSize:10,color:"#ff444477",marginBottom:1}}>▸ {t}</div>)}
              </div>
            </div>
          </div>
          <div style={{fontSize:9,color:"#444460",letterSpacing:"0.12em",marginBottom:8,paddingLeft:2}}>
            ─── {req.options.length} OPTIONS AVAILABLE ───
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {req.options.map(opt=>{
              const isSel=selectedOpts[reqId]===opt.id;
              const isExp=expandedOpt===`${reqId}_${opt.id}`;
              const unavail=opt.not_available;
              return(
                <div key={opt.id} style={{border:`1.5px solid ${isSel?opt.color:unavail?"#1e1e1e":"#222230"}`,
                  borderRadius:6,overflow:"hidden",opacity:unavail?0.4:1,transition:"border-color .2s"}}>
                  <div onClick={()=>!unavail&&setExpandedOpt(isExp?null:`${reqId}_${opt.id}`)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:unavail?"default":"pointer",
                      background:isSel?"#0d120d":isExp?"#0e0e18":"#0a0a12",transition:"background .15s"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",
                      justifyContent:"center",background:opt.color+"1a",border:`1px solid ${opt.color}55`,
                      fontSize:12,color:opt.color}}>{opt.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:"bold",color:unavail?"#333345":opt.color,marginBottom:2}}>
                        {opt.label}
                        {unavail&&<span style={{fontSize:8,color:"#ff444466",marginLeft:7,
                          padding:"1px 4px",border:"1px solid #ff444422",borderRadius:2}}>NOT AVAILABLE</span>}
                      </div>
                      <div style={{fontSize:10,lineHeight:1.4,
                        color:opt.result?.includes("✓")||opt.result?.includes("RESOLVES")||opt.result?.includes("ELIMINATES")?"#39ff14"
                          :opt.result?.includes("✗")||opt.result?.includes("NOT")||opt.result?.includes("Insufficient")?"#ff4444":"#aaaacc"}}>
                        {opt.result}
                      </div>
                    </div>
                    {!unavail&&(
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        <button onClick={e=>{e.stopPropagation();toggleOpt(reqId,opt.id);}} style={{
                          padding:"3px 8px",borderRadius:3,fontSize:9,cursor:"pointer",
                          fontFamily:"'Courier New',monospace",
                          background:isSel?opt.color+"22":"transparent",
                          border:`1px solid ${isSel?opt.color:opt.color+"44"}`,
                          color:isSel?opt.color:opt.color+"77",transition:"all .15s"}}>
                          {isSel?"✓ SEL":"SELECT"}
                        </button>
                        <button onClick={e=>{e.stopPropagation();setExpandedOpt(isExp?null:`${reqId}_${opt.id}`);}} style={{
                          padding:"3px 7px",borderRadius:3,fontSize:9,cursor:"pointer",
                          fontFamily:"'Courier New',monospace",background:"transparent",
                          border:"1px solid #2a2a3a",color:"#555570"}}>
                          {isExp?"▲":"▼"}
                        </button>
                      </div>
                    )}
                  </div>
                  {isExp&&!unavail&&(
                    <div style={{padding:"12px 14px",background:"#080810",borderTop:`1px solid ${opt.color}1a`}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        <div>
                          <div style={{fontSize:8,color:"#444460",letterSpacing:"0.12em",marginBottom:6}}>CONDITIONS</div>
                          {opt.conditions.map((c,i)=>(
                            <div key={i} style={{display:"flex",gap:6,marginBottom:4,fontSize:10,color:"#aaaacc",lineHeight:1.4}}>
                              <span style={{color:opt.color,flexShrink:0,marginTop:1}}>▸</span><span>{c}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{fontSize:8,color:"#444460",letterSpacing:"0.12em",marginBottom:6}}>TRADEOFF</div>
                          <div style={{fontSize:10,color:"#ccccee",lineHeight:1.5,padding:9,
                            background:"#0e0e18",borderRadius:4,border:"1px solid #2a2a3a"}}>{opt.tradeoff}</div>
                          {opt.id==="spr_A"&&(
                            <div style={{marginTop:8,padding:9,background:"#061006",borderRadius:4,
                              border:"1px solid #39ff1420"}}>
                              <div style={{fontSize:8,color:"#39ff1055",marginBottom:4}}>BONUSES UNLOCKED</div>
                              <div style={{fontSize:9,color:"#39ff14"}}>§506.3: area ×3 → {calc.allowSA===UL?"Unlimited":calc.allowSA.toLocaleString()} sf</div>
                              <div style={{fontSize:9,color:"#39ff14"}}>Travel +{calc.travelSA-calc.travelNS}ft → {calc.travelSA}ft</div>
                              <div style={{fontSize:9,color:"#39ff14"}}>Height +20ft → {calc.allowHtSA===UL?"Unlimited":calc.allowHtSA}ft</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Dependency chain diagram */}
      <div style={{marginTop:16,background:"#0a0a12",border:"1px solid #222230",borderRadius:7,padding:"14px 16px"}}>
        <div style={{fontSize:9,color:"#444460",letterSpacing:"0.12em",marginBottom:12}}>
          LIVE DEPENDENCY CHAIN — {calc.occ} / {calc.ct} / {calc.fa.toLocaleString()} sf
        </div>
        {[
          [{label:"Q2 Occ.",val:calc.occ,color:"#8888ff"},{arrow:`÷${calc.loadFactor}`},
           {label:"Ch10 Occ.Load",val:`${calc.occupantLoad} pax`,color:calc.exits>1?"#ffd700":"#39ff14"},{arrow:">49?"},
           {label:"Exits",val:`${calc.exits} req.`,color:calc.exits>1?"#ffd700":"#39ff14"},{arrow:"→"},
           {label:"Door width",val:`≥${calc.minDoor}"`,color:"#aaaacc"}],
          [{label:"Q4 Area",val:`${calc.fa.toLocaleString()} sf`,color:"#00cfff"},{arrow:"vs limit"},
           {label:"Ch5 Limit NS",val:`${calc.allowNS===UL?"Unlim.":calc.allowNS.toLocaleString()} sf`,color:calc.areaPassNS?"#39ff14":"#ff4444"},{arrow:calc.sprReq?"×3":"—"},
           {label:"With Spr.",val:`${calc.allowSA===UL?"Unlim.":calc.allowSA.toLocaleString()} sf`,color:"#00cfff"},{arrow:"§903.2"},
           {label:"Ch9 Spr.",val:calc.sprReq?"REQ.":"not req.",color:calc.sprReq?"#ff4444":"#39ff14"}],
        ].map((row,ri)=>(
          <div key={ri} style={{display:"flex",flexWrap:"wrap",gap:0,alignItems:"center",marginBottom:ri===0?10:0}}>
            {row.map((n,i)=>n.arrow?(
              <div key={i} style={{padding:"0 7px",display:"flex",flexDirection:"column",alignItems:"center"}}>
                <span style={{fontSize:7,color:"#333350",marginBottom:1}}>{n.arrow}</span>
                <span style={{fontSize:14,color:"#1e1e30"}}>→</span>
              </div>
            ):(
              <div key={i} style={{padding:"6px 10px",background:"#0e0e18",border:`1px solid ${n.color}33`,
                borderRadius:4,textAlign:"center",minWidth:85}}>
                <div style={{fontSize:7.5,color:"#444460",marginBottom:1}}>{n.label}</div>
                <div style={{fontSize:10,fontWeight:"bold",color:n.color}}>{n.val}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* CT comparison table */}
      <div style={{marginTop:14,background:"#0a0a12",border:"1px solid #222230",borderRadius:7,padding:"14px 16px"}}>
        <div style={{fontSize:9,color:"#444460",letterSpacing:"0.12em",marginBottom:10}}>
          CONSTRUCTION TYPE vs AREA — {calc.occ} / {calc.fa.toLocaleString()} sf target
        </div>
        {calc.ctAreaMap.map(row=>{
          const fits=row.areaMax===UL||row.areaMax>=calc.fa;
          const fitsSA=row.areaMaxSA===UL||row.areaMaxSA>=calc.fa;
          return(
            <div key={row.ct} onClick={()=>set("constType",row.ct)} style={{
              display:"flex",alignItems:"center",gap:7,padding:"4px 7px",marginBottom:2,borderRadius:3,
              background:inp.constType===row.ct?"#1a1a28":"transparent",
              border:`1px solid ${inp.constType===row.ct?"#3a3a55":"transparent"}`,cursor:"pointer",
            }}>
              <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                background:fits?"#39ff14":fitsSA?"#ffd700":"#ff4444",
                boxShadow:`0 0 4px ${fits?"#39ff14":fitsSA?"#ffd700":"#ff4444"}`}}/>
              <span style={{fontSize:9,color:"#8888aa",flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{row.ct}</span>
              <span style={{fontSize:9,color:fits?"#39ff14":fitsSA?"#ffd700":"#ff4444",flexShrink:0}}>
                {row.areaMax===UL?"Unlim.":row.areaMax.toLocaleString()} sf
              </span>
              {!fits&&fitsSA&&<span style={{fontSize:8,color:"#ffd70066",flexShrink:0}}>+spr</span>}
            </div>
          );
        })}
        <div style={{fontSize:8,color:"#333350",marginTop:5}}>🟢 fits NS · 🟡 needs sprinklers · 🔴 both exceeded · click to switch</div>
      </div>

      {/* Selected strategy */}
      {Object.keys(selectedOpts).length>0&&(
        <div style={{marginTop:14,background:"#0a0a12",border:"1px solid #333345",borderRadius:7,padding:"14px 16px"}}>
          <div style={{fontSize:9,color:"#444460",letterSpacing:"0.12em",marginBottom:10}}>SELECTED STRATEGY</div>
          {Object.entries(selectedOpts).map(([reqId,optId])=>{
            const req=calc.alternatives[reqId]; if(!req)return null;
            const opt=req.options.find(o=>o.id===optId); if(!opt)return null;
            return(
              <div key={reqId} style={{marginBottom:8,padding:9,background:"#0e0e18",
                border:`1px solid ${opt.color}33`,borderRadius:5}}>
                <div style={{fontSize:9,color:"#444460",marginBottom:4}}>{req.label.slice(0,50)}…</div>
                <div style={{fontSize:11,fontWeight:"bold",color:opt.color,marginBottom:3}}>{opt.icon} {opt.label.replace(/Option [A-E] — /,"")}</div>
                <div style={{fontSize:9,color:"#aaaacc"}}>{opt.result}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{background:"#040a04",minHeight:"100vh",fontFamily:"'Courier New',monospace",
      color:"#c8ffc8",display:"flex",flexDirection:"column"}}>
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.05) 3px,rgba(0,0,0,0.05) 4px)"}}/>
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(57,255,20,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(57,255,20,0.02) 1px,transparent 1px)",
        backgroundSize:"44px 44px"}}/>

      {/* HEADER */}
      <div style={{borderBottom:"1px solid #39ff1420",padding:"8px 20px",background:"#040a04f0",
        zIndex:20,flexShrink:0,display:"flex",alignItems:"center",gap:14}}>
        <div style={{display:"flex",gap:5}}>
          {["#ff4444","#ffd700","#39ff14"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c,boxShadow:`0 0 5px ${c}`}}/>)}
        </div>
        <span style={{fontSize:11,letterSpacing:"0.15em",color:"#39ff1077"}}>
          IBC 2021 — CIRCUIT + ALTERNATIVES ANALYZER
        </span>
        {/* TAB SWITCHER */}
        <div style={{display:"flex",gap:0,marginLeft:"auto",border:"1px solid #39ff1433",borderRadius:5,overflow:"hidden"}}>
          {[["circuit","⬡ Circuit"],["alternatives","⚡ Alternatives"]].map(([v,label])=>(
            <button key={v} onClick={()=>setView(v)} style={{
              padding:"5px 14px",cursor:"pointer",fontSize:10,fontFamily:"'Courier New',monospace",
              letterSpacing:"0.08em",border:"none",transition:"all .15s",
              background:view===v?"#39ff1422":"transparent",
              color:view===v?"#39ff14":"#39ff1055",
              borderRight:v==="circuit"?"1px solid #39ff1433":"none",
            }}>{label}</button>
          ))}
        </div>
        {/* Alert indicator */}
        {anyTrigger&&(
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",
            background:"#1a0404",border:"1px solid #ff444444",borderRadius:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#ff4444",
              boxShadow:"0 0 6px #ff4444",animation:"blink 1.5s infinite"}}/>
            <span style={{fontSize:9,color:"#ff4444",letterSpacing:"0.08em"}}>
              {Object.keys(calc.alternatives).length} REQUIREMENT{Object.keys(calc.alternatives).length>1?"S":""} TRIGGERED
            </span>
          </div>
        )}
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative",zIndex:1}}>
        {InputPanel}
        {view==="circuit" ? CircuitView : AlternativesView}
      </div>

      <style>{`
        @keyframes flash{0%{opacity:0.9}100%{opacity:0}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:#040a04}
        ::-webkit-scrollbar-thumb{background:#39ff1422;border-radius:2px}
        select option{background:#061006;color:#c8ffc8}
      `}</style>
    </div>
  );
}

// ── SHARED HELPERS ─────────────────────────────────────────────────────────────
const SS={background:"#061006",border:"1px solid #39ff1430",borderRadius:4,padding:"6px 8px",
  color:"#c8ffc8",fontSize:11,width:"100%",fontFamily:"'Courier New',monospace",cursor:"pointer",outline:"none",marginBottom:5};
function Lbl({children}){return <div style={{fontSize:9,color:"#39ff1044",letterSpacing:"0.15em",marginBottom:9}}>{children}</div>;}
function IG({label,sec,children}){
  return <div style={{marginBottom:13}}>
    <div style={{fontSize:10,color:"#aaccaa",fontWeight:"bold",marginBottom:2}}>{label}</div>
    <div style={{fontSize:8,color:"#39ff1033",marginBottom:5,letterSpacing:"0.07em"}}>{sec}</div>
    {children}
  </div>;
}
function Chp({color,children}){
  return <div style={{display:"inline-block",padding:"2px 7px",borderRadius:3,background:color+"14",
    border:`1px solid ${color}30`,color:color+"cc",fontSize:9,marginTop:3,marginRight:4,lineHeight:1.5}}>{children}</div>;
}
function RR({value,min,max,step,onChange,color,fmt}){
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
      <span style={{fontSize:9,color:color+"55"}}>{fmt(min)}</span>
      <span style={{fontSize:12,fontWeight:"bold",color,textShadow:`0 0 6px ${color}44`}}>{fmt(value)}</span>
      <span style={{fontSize:9,color:color+"55"}}>{fmt(max)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(Number(e.target.value))}
      style={{width:"100%",accentColor:color,cursor:"pointer",height:3}}/>
  </div>;
}
