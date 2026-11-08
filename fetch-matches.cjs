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
const dates=[];for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10).replace(/-/g,''));
async function fetchLeagueDay(league,day){
 const [code,label]=league;
 const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+code+'/scoreboard?dates='+day+'&limit=100&region=fr&lang=fr';
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'GOLD-PRONOS/1.0'}});
   if(!response.ok){if(response.status===400||response.status===404)return [];throw Error('HTTP '+response.status)}
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
  }catch(e){if(attempt===1)console.log('Source indisponible '+code+' '+day+': '+e.message)}
 }
 return [];
}
(async()=>{
 const tasks=[];for(const league of leagues)for(const day of dates)tasks.push(()=>fetchLeagueDay(league,day));
 const results=new Array(tasks.length);let cursor=0,completed=0,nonEmpty=0;
 const workers=Array.from({length:10},async()=>{while(true){const i=cursor++;if(i>=tasks.length)break;results[i]=await tasks[i]();if(results[i].length)nonEmpty++;completed++;if(completed%100===0)console.log('Collecte '+completed+'/'+tasks.length)}});
 await Promise.all(workers);
 const unique=new Map(results.flat().map(m=>[m.id,m]));
 const matches=[...unique.values()].sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
 const output={generatedAt:new Date().toISOString(),range:{from:from.toISOString(),to:to.toISOString()},matches};
 fs.writeFileSync('matches.json',JSON.stringify(output));
 console.log('Calendrier : '+matches.length+' rencontres vérifiées / '+leagues.length+' compétitions / '+dates.length+' dates.');
 if(!matches.length)console.log('AVERTISSEMENT : aucune rencontre fournie par ESPN. Publication de l’application maintenue, sans fabriquer de données.');
})();
