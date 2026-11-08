'use strict';
const fs=require('node:fs');
const leagues=[
 ['eng.1','Angleterre · Premier League'],['eng.2','Angleterre · Championship'],
 ['esp.1','Espagne · LaLiga'],['esp.2','Espagne · Segunda'],
 ['ger.1','Allemagne · Bundesliga'],['ita.1','Italie · Serie A'],['fra.1','France · Ligue 1'],
 ['ned.1','Pays-Bas · Eredivisie'],['por.1','Portugal · Liga'],['tur.1','Turquie · Süper Lig'],
 ['nor.1','Norvège · Eliteserien'],['swe.1','Suède · Allsvenskan'],['sui.1','Suisse · Super League'],
 ['ksa.1','Arabie saoudite · Pro League'],['cze.1','Tchéquie · First League'],['usa.1','États-Unis · MLS'],
 ['rou.1','Roumanie · Liga I'],['rus.1','Russie · Premier League'],['chn.1','Chine · Super League'],
 ['jpn.1','Japon · J1 League'],['bra.1','Brésil · Série A'],['arg.1','Argentine · Liga Profesional'],
 ['mex.1','Mexique · Liga MX'],['uefa.champions','UEFA · Ligue des champions'],
 ['uefa.europa','UEFA · Ligue Europa'],['uefa.europa.conf','UEFA · Ligue Conférence'],
 ['afc.champions','AFC · Ligue des champions'],['fifa.world','FIFA · Compétitions internationales'],
 ['caf.nations','CAF · Coupe d’Afrique des nations'],['uefa.wchampions','UEFA · Ligue des championnes']
];
const today=new Date();today.setUTCHours(0,0,0,0);
const from=new Date(today);from.setUTCDate(from.getUTCDate()-35);
const to=new Date(today);to.setUTCDate(to.getUTCDate()+14);
const key=d=>d.toISOString().slice(0,10).replace(/-/g,'');
const dateRange=key(from)+'-'+key(to);
async function fetchLeague([code,label]){
 const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+code+'/scoreboard?dates='+dateRange+'&limit=100&region=fr&lang=fr';
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'GOLD-PRONOS/1.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  return (data.events||[]).map(event=>{
   const comp=event.competitions?.[0],teams=comp?.competitors||[];
   const home=teams.find(t=>t.homeAway==='home')||teams[0],away=teams.find(t=>t.homeAway==='away')||teams[1];
   if(!home||!away||!event.date)return null;
   const st=comp?.status?.type||event.status?.type||{},state=st.state;
   return {id:'espn-'+event.id,utcDate:event.date,status:st.completed||state==='post'?'FINISHED':state==='in'?'IN_PLAY':'SCHEDULED',
    competition:{name:label,code:'ESPN-'+code},
    homeTeam:{id:String(home.team?.id||home.id||''),name:home.team?.displayName||home.team?.name||'Équipe domicile'},
    awayTeam:{id:String(away.team?.id||away.id||''),name:away.team?.displayName||away.team?.name||'Équipe extérieure'},
    score:{fullTime:{home:home.score==null?null:Number(home.score),away:away.score==null?null:Number(away.score)}},source:'ESPN'};
  }).filter(Boolean);
 }catch(e){if(!String(e.message).includes('HTTP 400'))console.log('Source indisponible '+code+' '+date+': '+e.message);return []}
}
(async()=>{
 const tasks=leagues.map(league=>()=>fetchLeague(league));
 const results=new Array(tasks.length);let cursor=0,completed=0;
 const workers=Array.from({length:8},async()=>{while(true){const i=cursor++;if(i>=tasks.length)break;results[i]=await tasks[i]();completed++;if(completed%100===0)console.log('Collecte '+completed+'/'+tasks.length)}});
 await Promise.all(workers);
 const unique=new Map(results.flat().map(m=>[m.id,m]));
 const matches=[...unique.values()].sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
 if(!matches.length)throw Error('Aucun match vérifié reçu : publication annulée.');
 const output={generatedAt:new Date().toISOString(),range:{from:from.toISOString(),to:to.toISOString()},matches};
 fs.writeFileSync('matches.json',JSON.stringify(output));
 console.log('Calendrier vérifié : '+matches.length+' rencontres / '+leagues.length+' compétitions / période '+key(from)+' à '+key(to)+'.');
})();