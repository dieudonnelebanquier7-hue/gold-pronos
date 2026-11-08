(()=>{'use strict';
const $=id=>document.getElementById(id),API='https://site.api.espn.com/apis/site/v2/sports/soccer/';
const leagues=[['eng.1','Angleterre · Premier League'],['eng.2','Angleterre · Championship'],['esp.1','Espagne · LaLiga'],['esp.2','Espagne · Segunda'],['ger.1','Allemagne · Bundesliga'],['ita.1','Italie · Serie A'],['fra.1','France · Ligue 1'],['ned.1','Pays-Bas · Eredivisie'],['por.1','Portugal · Liga'],['tur.1','Turquie · Süper Lig'],['nor.1','Norvège · Eliteserien'],['swe.1','Suède · Allsvenskan'],['sui.1','Suisse · Super League'],['ksa.1','Arabie saoudite · Pro League'],['cze.1','Tchéquie · First League'],['usa.1','États-Unis · MLS'],['rou.1','Roumanie · Liga I'],['rus.1','Russie · Premier League'],['chn.1','Chine · Super League'],['jpn.1','Japon · J1 League'],['bra.1','Brésil · Série A'],['arg.1','Argentine · Liga Profesional'],['mex.1','Mexique · Liga MX'],['uefa.champions','UEFA · Ligue des champions'],['uefa.europa','UEFA · Ligue Europa'],['uefa.europa.conf','UEFA · Ligue Conférence'],['afc.champions','AFC · Ligue des champions'],['fifa.world','FIFA · Compétitions mondiales'],['caf.nations','CAF · Coupe d’Afrique des nations'],['uefa.wchampions','UEFA · Ligue des championnes']];
const standingsLeagues=leagues.filter(([code])=>!['uefa.champions','uefa.europa','uefa.europa.conf','afc.champions','fifa.world','caf.nations','uefa.wchampions'].includes(code));
let matches=[],activeLeague='eng.1',busy=false;
const dateKey=d=>{const x=new Date(d);return x.getFullYear()+String(x.getMonth()+1).padStart(2,'0')+String(x.getDate()).padStart(2,'0')};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function appLocale(){return ({fr:'fr-FR',en:'en-GB',es:'es-ES',pt:'pt-PT',de:'de-DE',it:'it-IT',ar:'ar'})[window.GoldI18n?.getLanguage?.()||readAppSettings().language||'fr']||'fr-FR'}
function appDate(value,options={}){const d=new Date(value);if(Number.isNaN(d.getTime()))return 'Date inconnue';const prefs=readAppSettings();try{return new Intl.DateTimeFormat(appLocale(),{timeZone:prefs.timezone||'Africa/Porto-Novo',...options}).format(d)}catch(e){return new Intl.DateTimeFormat(appLocale(),options).format(d)}}
async function get(url,ms=9000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
async function withTimeout(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message||'Délai de réponse dépassé')),ms)})])}finally{clearTimeout(timer)}}
function crestUrl(team){const list=Array.isArray(team?.logos)?team.logos:[];const item=list.find(x=>x?.href&&(/default|full|primary/i.test((x.rel||[]).join(' '))||!x.rel))||list.find(x=>x?.href);const url=item?.href||team?.logo||team?.crest||'';try{const u=new URL(url);return u.protocol==='https:'?u.href:''}catch(_){return ''}}
function isNationalCompetition(code){return ['fifa.world','caf.nations','uefa.euro','uefa.nations','conmebol.copa','concacaf.gold','afc.asian'].includes(String(code||''))}
const FIFA_TO_ISO2={ENG:'gb-eng',SCO:'gb-sct',WAL:'gb-wls',NIR:'gb-nir',FRA:'fr',GER:'de',ESP:'es',ITA:'it',POR:'pt',NED:'nl',BEL:'be',SUI:'ch',AUT:'at',DEN:'dk',SWE:'se',NOR:'no',FIN:'fi',POL:'pl',CZE:'cz',SVK:'sk',CRO:'hr',SRB:'rs',BIH:'ba',SVN:'si',HUN:'hu',ROU:'ro',BUL:'bg',GRE:'gr',TUR:'tr',UKR:'ua',RUS:'ru',IRL:'ie',ISL:'is',USA:'us',CAN:'ca',MEX:'mx',BRA:'br',ARG:'ar',URU:'uy',CHI:'cl',COL:'co',ECU:'ec',PER:'pe',PAR:'py',BOL:'bo',JPN:'jp',KOR:'kr',CHN:'cn',AUS:'au',NZL:'nz',IRN:'ir',KSA:'sa',QAT:'qa',UAE:'ae',IRQ:'iq',JOR:'jo',UZB:'uz',IND:'in',SEN:'sn',CIV:'ci',NGA:'ng',GHA:'gh',CMR:'cm',MAR:'ma',ALG:'dz',TUN:'tn',EGY:'eg',RSA:'za',COD:'cd',CGO:'cg',BFA:'bf',MLI:'ml',GNB:'gw',CPV:'cv',GAB:'ga',ANG:'ao',ZAM:'zm',ZIM:'zw',MOZ:'mz',TAN:'tz',UGA:'ug',KEN:'ke',ETH:'et',BEN:'bj',TOG:'tg',GUI:'gn',LBR:'lr',SLE:'sl',MTN:'mr',NAM:'na',BOT:'bw',MAD:'mg',COM:'km',LES:'ls',SWZ:'sz',HAI:'ht',JAM:'jm',CRC:'cr',PAN:'pa',HON:'hn',GUA:'gt',SLV:'sv',TRI:'tt',CUB:'cu',DOM:'do',PUR:'pr',FRO:'fo',LUX:'lu',EST:'ee',LVA:'lv',LTU:'lt',GEO:'ge',ARM:'am',AZE:'az',KAZ:'kz',THA:'th',VIE:'vn',MAS:'my',IDN:'id',PHI:'ph',HKG:'hk',TPE:'tw',GBR:'gb',CHE:'ch',DEU:'de',PRT:'pt',NLD:'nl',DNK:'dk',HRV:'hr',BGR:'bg',GRC:'gr',SVK:'sk',SVN:'si',HUN:'hu',ROU:'ro',AUT:'at',LUX:'lu',CYP:'cy',MLT:'mt',MDA:'md',MNE:'me',MKD:'mk',BLR:'by',LTU:'lt',LVA:'lv',EST:'ee',GEO:'ge',ARM:'am',AZE:'az',KAZ:'kz',KGZ:'kg',TJK:'tj',TKM:'tm',UZB:'uz',AFG:'af',ALB:'al',AND:'ad',ATG:'ag',ARU:'aw',BAH:'bs',BAN:'bd',BAR:'bb',BER:'bm',BLR:'by',BLZ:'bz',BRU:'bn',BDI:'bi',CAM:'kh',CAF:'cf',CHA:'td',CYP:'cy',DMA:'dm',DJI:'dj',ERI:'er',EQG:'gq',FIJ:'fj',GAM:'gm',GRN:'gd',GUY:'gy',ISR:'il',KOS:'xk',KGZ:'kg',LIE:'li',LBA:'ly',LCA:'lc',MAC:'mo',MWI:'mw',MDV:'mv',MLT:'mt',MDA:'md',MNE:'me',MGL:'mn',MYA:'mm',NEP:'np',NCL:'nc',PAK:'pk',PNG:'pg',PRK:'kp',RWA:'rw',SAM:'ws',SEY:'sc',SKN:'kn',SOL:'sb',SOM:'so',SSD:'ss',STP:'st',SUD:'sd',SUR:'sr',SYR:'sy',TJK:'tj',TKM:'tm',TLS:'tl',TAH:'pf',VIN:'vc',VAN:'vu',YEM:'ye'};
const COUNTRY_TO_ISO2={'benin':'bj','france':'fr','germany':'de','espagne':'es','spain':'es','italie':'it','italy':'it','portugal':'pt','pays bas':'nl','netherlands':'nl','belgique':'be','belgium':'be','suisse':'ch','switzerland':'ch','angleterre':'gb-eng','england':'gb-eng','ecosse':'gb-sct','scotland':'gb-sct','pays de galles':'gb-wls','wales':'gb-wls','irlande du nord':'gb-nir','northern ireland':'gb-nir','etats unis':'us','united states':'us','usa':'us','bresil':'br','brazil':'br','argentine':'ar','argentina':'ar','maroc':'ma','morocco':'ma','senegal':'sn','cote divoire':'ci','ivory coast':'ci','nigeria':'ng','cameroun':'cm','cameroon':'cm','ghana':'gh','algerie':'dz','algeria':'dz','tunisie':'tn','tunisia':'tn','afrique du sud':'za','south africa':'za','republique democratique du congo':'cd','congo dr':'cd','japon':'jp','japan':'jp','coree du sud':'kr','south korea':'kr','korea republic':'kr','chine':'cn','china':'cn','australie':'au','australia':'au','nouvelle zelande':'nz','new zealand':'nz','arabie saoudite':'sa','saudi arabia':'sa','iran':'ir','irak':'iq','iraq':'iq','qatar':'qa','emirats arabes unis':'ae','united arab emirates':'ae','cap vert':'cv','cape verde':'cv','republique tcheque':'cz','czech republic':'cz','tchequie':'cz','bosnie herzegovine':'ba','north macedonia':'mk','macedoine du nord':'mk','ukraine':'ua','russie':'ru','russia':'ru','suede':'se','sweden':'se','norvege':'no','norway':'no','danemark':'dk','denmark':'dk','finlande':'fi','finland':'fi','pologne':'pl','poland':'pl','croatie':'hr','croatia':'hr','serbie':'rs','serbia':'rs','roumanie':'ro','romania':'ro','grece':'gr','greece':'gr','turquie':'tr','turkey':'tr','mexique':'mx','mexico':'mx','colombie':'co','colombia':'co','chili':'cl','chile':'cl','uruguay':'uy','equateur':'ec','ecuador':'ec','perou':'pe','peru':'pe','paraguay':'py','bolivie':'bo','bolivia':'bo','jamaica':'jm','canada':'ca','costa rica':'cr','panama':'pa','honduras':'hn','guatemala':'gt','el salvador':'sv','trinite et tobago':'tt','trinidad and tobago':'tt'};
function teamFlagUrl(team){
 const direct=team?.nationalFlag||team?.flag||team?.country?.flag;
 if(typeof direct==='string'&&/^https:\/\//i.test(direct))return direct;
 const raw=String(team?.country?.code||team?.country?.abbreviation||team?.abbreviation||team?.tla||'').toUpperCase();
 let iso=FIFA_TO_ISO2[raw]||(/^[A-Z]{2}$/.test(raw)?raw.toLowerCase():'');
 if(!iso){const names=[team?.country?.name,team?.country?.displayName,team?.country,team?.location,team?.displayName,team?.name,team].filter(x=>typeof x==='string');for(const name of names){const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,' ').trim().replace(/\s+/g,' ');if(COUNTRY_TO_ISO2[key]){iso=COUNTRY_TO_ISO2[key];break}}}
 return iso?'https://flagcdn.com/w160/'+iso+'.png':'';
}
function crestMarkup(name,url,kind='crest'){const label=String(name||'Équipe'),initials=label.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'FC',isFlag=String(kind).includes('flag');return '<span class="gp-crest '+kind+'">'+(url?'<img loading="lazy" src="'+safe(url)+'" alt="'+(isFlag?'Drapeau de ':'Écusson de ')+safe(label)+'" onerror="this.parentElement.classList.add(\'is-fallback\');this.remove()">':'')+'<span class="gp-crest-fallback" aria-hidden="true">'+safe(initials)+'</span></span>'}
function mapEvent(e,code,label){const c=e.competitions?.[0]||{},ts=c.competitors||[],h=ts.find(x=>x.homeAway==='home')||ts[0]||{},a=ts.find(x=>x.homeAway==='away')||ts[1]||{},st=c.status?.type||e.status?.type||{},national=isNationalCompetition(code);return{id:e.id,code:code,league:label,competition:c.name||label,home:h.team?.displayName||h.team?.name||'Équipe inconnue',away:a.team?.displayName||a.team?.name||'Équipe inconnue',homeLogo:national?teamFlagUrl(h.team):crestUrl(h.team),awayLogo:national?teamFlagUrl(a.team):crestUrl(a.team),homeNational:national,awayNational:national,homeId:h.id||h.team?.id,awayId:a.id||a.team?.id,homeScore:h.score??null,awayScore:a.score??null,date:e.date,status:st.state==='in'?'LIVE':st.completed?'FINISHED':st.state==='post'?'FINISHED':'SCHEDULED',live:st.state==='in',finished:!!st.completed,period:c.status?.displayClock||e.status?.displayClock||'',venue:c.venue?.fullName||'',raw:e}}
function liveMinute(m){if(!m.live||m.clockBaseSeconds===null||m.clockBaseSeconds===undefined)return '';const detail=String(m.periodDetail||'').toLowerCase();if(/half.?time|mi-temps|break/.test(detail))return 'Mi-temps';const elapsed=Math.max(0,Math.floor((Date.now()-(m.clockUpdatedAt||Date.now()))/1000));return Math.floor((m.clockBaseSeconds+(m.clockRunning?elapsed:0))/60+0.999)+'′'}
function status(m){const d=new Date(m.date);const dateLabel=Number.isNaN(d.getTime())?'Date inconnue':appDate(d,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});if(m.live){const minute=liveMinute(m);return '● EN DIRECT'+(minute?' · '+minute:'')+' · '+dateLabel}return m.finished?'TERMINÉ · '+dateLabel:dateLabel}
function card(m){const b=document.createElement('button');b.className='match'+(m.live?' is-live':'');b.innerHTML='<span class="league"></span><span class="teams"><span class="match-side home-side">'+crestMarkup(m.home,m.homeLogo,m.homeNational?'match-flag':'match-crest')+'<b class="team-name"></b></span><span class="match-side away-side">'+crestMarkup(m.away,m.awayLogo,m.awayNational?'match-flag':'match-crest')+'<b class="team-name"></b></span></span><span class="match-result"><span class="score"></span><span class="state"></span></span>';b.querySelector('.league').textContent=m.league;b.querySelector('.home-side .team-name').textContent=m.home;b.querySelector('.away-side .team-name').textContent=m.away;b.querySelector('.score').textContent=m.homeScore!==null&&m.homeScore!==undefined&&m.awayScore!==null&&m.awayScore!==undefined?m.homeScore+' - '+m.awayScore:'VS';const state=b.querySelector('.state');state.textContent=status(m);if(m.live)state.classList.add('live-state');b.onclick=()=>openMatch(m);return b}
const PREF_KEY='gold-pronos-onboarding-v1';
function readFootballPrefs(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}catch(e){return {}}}
function saveFootballPrefs(p){localStorage.setItem(PREF_KEY,JSON.stringify({...p,completed:true,updatedAt:new Date().toISOString()}));}
function showOnboarding(force=false){const saved=readFootballPrefs();if(force||!saved.completed){$('onboarding').hidden=false;$('onboard-player').value=saved.player||'';$('onboard-club').value=saved.club||'';$('onboard-country').value=saved.country||'';const sel=$('onboard-competitions');[...sel.options].forEach(o=>o.selected=(saved.competitions||[]).includes(o.value));}}
function renderPersonalizedHome(){
 const box=$('personalized-home');if(!box)return;const p=readFootballPrefs();
 if(!p.completed||!(p.player||p.club||p.country||(p.competitions||[]).length)){box.hidden=true;return}
 box.hidden=false;const fav=[p.club,p.country].filter(Boolean);
 const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const related=matches.filter(m=>fav.some(n=>norm(m.home+' '+m.away).includes(norm(n)))||(p.competitions||[]).includes(m.code))
  .sort((a,b)=>{
   const priority=m=>m.live?0:!m.finished&&new Date(m.date).getTime()>=Date.now()?1:2;
   const pa=priority(a),pb=priority(b);if(pa!==pb)return pa-pb;
   return pa===2?new Date(b.date)-new Date(a.date):new Date(a.date)-new Date(b.date);
  }).slice(0,4);
 box.innerHTML='<div class="personalized-heading"><div><span class="eyebrow">TON ESPACE PERSONNALISÉ</span><h3>Bienvenue dans ton univers football 👋</h3><p>'+[p.player?'⭐ '+safe(p.player):'',p.club?'🏆 '+safe(p.club):'',p.country?'🌍 '+safe(p.country):''].filter(Boolean).join(' · ')+'</p></div><button class="ghost" id="edit-football-prefs" type="button">Modifier</button></div>'+(related.length?'<div class="personalized-matches"><b>Rencontres liées à tes favoris</b>'+related.map(m=>'<div>'+safe(m.home)+' <strong>'+(m.homeScore!==null?m.homeScore+' - '+m.awayScore:'VS')+'</strong> '+safe(m.away)+' <small>'+safe(status(m))+'</small></div>').join('')+'</div>':'<p class="muted">Tes choix sont enregistrés. Les matchs liés à tes favoris apparaîtront ici lorsqu’ils seront au calendrier.</p>');
 $('edit-football-prefs').onclick=()=>showOnboarding(true);
}
function initOnboarding(){const form=$('onboarding-form');if(!form)return;form.onsubmit=e=>{e.preventDefault();const p={player:$('onboard-player').value.trim(),club:$('onboard-club').value.trim(),country:$('onboard-country').value.trim(),competitions:[...$('onboard-competitions').selectedOptions].map(o=>o.value)};saveFootballPrefs(p);$('onboarding').hidden=true;renderPersonalizedHome();};$('onboarding-skip').onclick=()=>{$('onboarding').hidden=true;saveFootballPrefs({});};showOnboarding();renderPersonalizedHome();}
function render(){const q=$('search').value.toLowerCase(),f=$('date-filter').value,now=new Date(),today=dateKeyInAppZone(now),tomorrow=dateKeyInAppZone(now+86400000);const startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()),endToday=new Date(startToday);endToday.setDate(endToday.getDate()+1);let list=matches.filter(m=>(!q||(m.home+' '+m.away+' '+m.league).toLowerCase().includes(q)));list=list.filter(m=>{const d=new Date(m.date);if(f==='live')return m.live;if(f==='finished')return m.finished;if(f==='upcoming')return !m.live&&!m.finished&&d>now;if(f==='today')return dateKeyInAppZone(m.date)===today;if(f==='tomorrow')return dateKeyInAppZone(m.date)===tomorrow;if(f==='next7')return !m.live&&!m.finished&&d>=now&&d<now.getTime()+7*86400000;if(f==='next14')return !m.live&&!m.finished&&d>=now&&d<now.getTime()+14*86400000;if(f==='past7')return m.finished&&d>=now.getTime()-7*86400000;return true});list.sort((x,y)=>new Date(x.date)-new Date(y.date));const box=$('home-matches');box.replaceChildren();if(!list.length){box.innerHTML='<div class="notice">Aucun match vérifié pour cette période. Choisis une autre date ou actualise le calendrier.</div>'}else{let last='';for(const m of list.slice(0,350)){const key=dateKeyInAppZone(m.date);if(key!==last){last=key;const h=document.createElement('h3');h.className='day-heading';h.textContent=appDate(m.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'});box.append(h)}box.append(card(m))}}$('match-count').textContent=matches.length}
function renderLive(){const box=$('live-matches');box.replaceChildren();const l=matches.filter(m=>m.live);if(!l.length){box.innerHTML='<div class="notice">Aucun match en direct dans les compétitions suivies à cet instant. Les matchs terminés restent consultables dans le calendrier.</div>';return}l.forEach(m=>box.append(card(m)))}

function officialLineups(data){
 const groups=[];const sources=[data?.lineups,data?.rosters,data?.boxscore?.players].filter(Array.isArray);
 for(const src of sources)for(const g of src){const team=g.team?.displayName||g.team?.name||g.team?.shortDisplayName||'Équipe';let entries=[];
  if(Array.isArray(g.athletes))entries.push(...g.athletes);
  for(const sg of (g.statistics||[]))if(Array.isArray(sg.athletes))entries.push(...sg.athletes);
  const starters=entries.filter(p=>p.starter===true||p.isStarter===true||p.athlete?.starter===true||p.athlete?.isStarter===true||String(p.lineupStatus||p.athlete?.lineupStatus||'').toLowerCase()==='starter');
  const uniq=[...new Map(starters.map(p=>{const z=p.athlete||p;return [z.id||z.displayName||z.fullName,z]})).values()];
  if(uniq.length>=11)groups.push({team,players:uniq.slice(0,11).map(p=>({name:p.displayName||p.fullName||p.shortName||'Joueur',position:p.position?.abbreviation||p.position?.displayName||''}))});
 }
 const unique=[...new Map(groups.map(g=>[g.team,g])).values()];return unique.length>=2?unique.slice(0,2):[];
}
function lineupHtml(groups){return '<h3>Compositions officielles</h3><p class="muted">Titulaires publiés par la source de la rencontre.</p><div class="stats-grid">'+groups.map(g=>'<div class="stat-card"><b>'+safe(g.team)+'</b><ol>'+g.players.map(p=>'<li>'+safe(p.name)+(p.position?' · '+safe(p.position):'')+'</li>').join('')+'</ol></div>').join('')+'</div>'}
async function pollOfficialLineups(){
 const now=Date.now(),due=matches.filter(m=>!m.live&&!m.finished&&!m.lineups?.length&&new Date(m.date).getTime()-now<=180*60000&&new Date(m.date).getTime()-now>0&&(!m.lineupCheckAt||now-m.lineupCheckAt>180000)).slice(0,12);
 if(!due.length)return;
 await Promise.allSettled(due.map(async m=>{m.lineupCheckAt=Date.now();try{const d=await get(API+m.code+'/summary?event='+encodeURIComponent(m.id)+'&region=fr&lang=fr',10000);const groups=officialLineups(d);if(groups.length){m.lineups=groups;m.lineupPublishedAt=Date.now();render();renderLive();const box=$('match-detail');if(!$('match-modal').hidden&&box?.dataset.matchId===m.id)box.insertAdjacentHTML('beforeend',lineupHtml(groups));await localMatchAlerts()}}catch(e){}}));
}

const MATCH_STAT_LABELS={
 "fouls":"Fautes","foul":"Fautes","yellow cards":"Cartons jaunes","yellow card":"Carton jaune","yellowcard":"Cartons jaunes","red cards":"Cartons rouges","red card":"Carton rouge","redcard":"Cartons rouges","offsides":"Hors-jeu","offside":"Hors-jeu","corner kicks":"Corners","corner kick":"Corner","corners":"Corners","saves":"Arrêts du gardien","shots saved":"Tirs arrêtés","possession":"Possession","possession pct":"Possession","shots":"Tirs","total shots":"Tirs","shots on goal":"Tirs cadrés","shots on target":"Tirs cadrés","on target":"Tirs cadrés","on target %":"Précision des tirs cadrés","shots on target %":"Précision des tirs cadrés","shots off target":"Tirs non cadrés","blocked shots":"Tirs bloqués","penalty goals":"Buts sur penalty","penalty kicks taken":"Penalties tirés","penalty kick attempts":"Penalties tirés","accurate passes":"Passes réussies","passes":"Passes tentées","total passes":"Passes tentées","pass completion %":"Précision des passes","accurate crosses":"Centres réussis","crosses":"Centres tentés","total crosses":"Centres tentés","cross %":"Précision des centres","long balls":"Longs ballons","accurate long balls":"Longs ballons réussis","long balls %":"Précision des longs ballons","effective tackles":"Tacles réussis","tackles":"Tacles tentés","total tackles":"Tacles tentés","tackle %":"Réussite des tacles","interceptions":"Interceptions","effective clearances":"Dégagements réussis","clearances":"Dégagements","total clearances":"Dégagements","big chances":"Grosses occasions","big chances created":"Grosses occasions créées","hit woodwork":"Poteaux ou barres","touches":"Touches de balle","duels won":"Duels gagnés","ground duels won":"Duels au sol gagnés","aerial duels won":"Duels aériens gagnés","dribbles completed":"Dribbles réussis","successful dribbles":"Dribbles réussis","fouls committed":"Fautes commises","errors leading to goal":"Erreurs menant à un but"
};
function matchStatLabel(item){
 const raw=String(item?.label||item?.name||item?.abbreviation||"Statistique").trim();
 const key=raw.toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
 if((window.GoldI18n?.getLanguage?.()||"fr")==="fr")return MATCH_STAT_LABELS[key]||raw;
 return raw;
}
function matchEventLabel(item){
 const raw=String(xtext(item)||"Événement"),key=raw.toLowerCase();
 if((window.GoldI18n?.getLanguage?.()||"fr")!=="fr")return raw;
 const map={"goal":"But","own goal":"But contre son camp","yellow card":"Carton jaune","red card":"Carton rouge","substitution":"Remplacement","penalty":"Penalty","penalty scored":"Penalty transformé","missed penalty":"Penalty manqué","second yellow card":"Deuxième carton jaune","var":"Assistance vidéo (VAR)","offside":"Hors-jeu","start of period":"Début de période","end of period":"Fin de période"};
 return map[key]||raw;
}
function matchFromSummary(data,base){
 const c=data?.header?.competitions?.[0]||data?.competitions?.[0]||{},ts=c.competitors||[];
 if(ts.length<2)return base;
 const h=ts.find(x=>x.homeAway==="home")||ts[0],a=ts.find(x=>x.homeAway==="away")||ts[1];
 const hTeam=h?.team||h,aTeam=a?.team||a;
 const hid=h?.id||hTeam?.id,aid=a?.id||aTeam?.id;
 const normName=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 if(base.homeId&&hid&&String(base.homeId)!==String(hid))return base;
 if(base.awayId&&aid&&String(base.awayId)!==String(aid))return base;
 if((!base.homeId||!hid)&&normName(base.home)!==normName(hTeam.displayName||hTeam.name))return base;
 if((!base.awayId||!aid)&&normName(base.away)!==normName(aTeam.displayName||aTeam.name))return base;
 const st=c.status?.type||data?.header?.status?.type||{};
 const next={...base};
 if(h?.score!==undefined&&h?.score!==null)next.homeScore=Number(h.score);
 if(a?.score!==undefined&&a?.score!==null)next.awayScore=Number(a.score);
 if(st.state)next.live=st.state==="in";
 if(st.completed!==undefined)next.finished=!!st.completed||st.state==="post";
 if(st.detail||st.shortDetail)next.periodDetail=st.detail||st.shortDetail;
 if(st.displayClock)next.period=st.displayClock;
 if(c.venue?.fullName)next.venue=c.venue.fullName;
 next.status=next.live?"LIVE":next.finished?"FINISHED":"SCHEDULED";
 return next;
}
function detailHeader(m){
 return '<div class="md-head"><span class="eyebrow">'+safe(m.competition||m.league)+'</span><div class="md-scoreboard"><div class="md-side">'+crestMarkup(m.home,m.homeLogo,m.homeNational?'detail-flag':'detail-crest')+'<b>'+safe(m.home)+'</b></div><div class="md-score">'+(m.homeScore!=null&&m.awayScore!=null?m.homeScore+' – '+m.awayScore:'VS')+'<small>'+safe(m.live?liveMinute(m)||"EN DIRECT":m.finished?"TERMINÉ":"À VENIR")+'</small></div><div class="md-side">'+crestMarkup(m.away,m.awayLogo,m.awayNational?'detail-flag':'detail-crest')+'<b>'+safe(m.away)+'</b></div></div><div class="md-meta">'+safe(appDate(m.date,{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}))+' · '+safe(m.venue||"Stade non communiqué")+'</div></div>';
}
function teamRecentForm(teamName,teamId,excludeId){
 const list=recent(teamName,excludeId,null,teamId).slice(0,5);
 if(!list.length)return '<div class="md-empty">Aucun résultat récent vérifié disponible dans le calendrier chargé.</div>';
 return '<div class="md-form-list">'+list.map(m=>{
  const home=teamId&&m.homeId?String(m.homeId)===String(teamId):m.home===teamName;
  const gf=Number(home?m.homeScore:m.awayScore),ga=Number(home?m.awayScore:m.homeScore),result=gf>ga?'V':gf===ga?'N':'D';
  const opponent=home?m.away:m.home;
  return '<article class="md-form-row"><span class="md-form-result '+(result==='V'?'win':result==='D'?'loss':'draw')+'">'+result+'</span><span>'+safe(opponent)+'</span><b>'+gf+' – '+ga+'</b><small>'+safe(appDate(m.date,{day:'2-digit',month:'short'}))+'</small></article>';
 }).join('')+'</div><p class="md-note">Résultats vérifiés parmi les rencontres déjà chargées par GOLD PRONOS ; ce relevé peut être incomplet.</p>';
}
function headToHead(m){
 const same=(x,id,name)=>id&&x.homeId&&x.awayId?(String(x.homeId)===String(id)||String(x.awayId)===String(id)):(x.home===name||x.away===name);
 const list=matches.filter(x=>x.id!==m.id&&x.finished&&x.homeScore!=null&&x.awayScore!=null&&same(x,m.homeId,m.home)&&same(x,m.awayId,m.away)).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
 if(!list.length)return '<div class="md-empty">Aucune confrontation directe vérifiée entre ces deux équipes dans les résultats actuellement chargés. Aucun historique ne sera inventé.</div>';
 return '<h3>Confrontations disponibles</h3><div class="md-h2h-list">'+list.map(x=>'<article class="md-h2h-row"><span>'+safe(x.home)+'</span><b>'+x.homeScore+' – '+x.awayScore+'</b><span>'+safe(x.away)+'</span><small>'+safe(appDate(x.date,{day:'2-digit',month:'short',year:'numeric'}))+'</small></article>').join('')+'</div><p class="md-note">Historique limité aux résultats vérifiés déjà chargés dans l’application.</p>';
}
function mdPanel(data,key){
 const teams=data?.boxscore?.teams||[],groups=data?.boxscore?.players||[],lineups=officialLineups(data),events=data?.commentary?.items||data?.plays||[];
 if(key==="stats"){
  if(teams.length<2)return '<div class="md-empty">Statistiques officielles non communiquées pour ce match.</div>';
  const left=teams[0].statistics||[],right=teams[1].statistics||[],map=new Map(right.map(x=>[String(x.name||x.abbreviation||x.label||"").toLowerCase(),x]));
  const rows=left.map(x=>({x,y:map.get(String(x.name||x.abbreviation||x.label||"").toLowerCase())})).filter(r=>r.y&&r.x.displayValue!=null&&r.y.displayValue!=null);
  if(!rows.length)return '<div class="md-empty">Aucune statistique comparable publiée par la source.</div>';
  return '<div class="md-team-labels"><b>'+safe(teams[0].team?.displayName||"Domicile")+'</b><b></b><b>'+safe(teams[1].team?.displayName||"Extérieur")+'</b></div>'+rows.map(({x,y})=>'<div class="md-stat"><div class="md-stat-values"><b>'+safe(x.displayValue)+'</b><span>'+safe(matchStatLabel(x))+'</span><b>'+safe(y.displayValue)+'</b></div></div>').join('');
 }
 if(key==="lineups")return lineups.length?lineupHtml(lineups):'<div class="md-empty">Les compositions officielles ne sont pas encore publiées.</div>';
 if(key==="events")return events.length?'<ol class="md-events">'+events.slice(-30).reverse().map(x=>'<li><time>'+safe(x.clock?.displayValue||x.time||"")+'</time><span>'+safe(matchEventLabel(x))+'</span></li>').join('')+'</ol>':'<div class="md-empty">Aucun événement détaillé communiqué par la source.</div>';
 if(key==="form")return '<div class="md-form-grid"><section><h3>Forme récente · '+safe(data.match?.home||"Domicile")+'</h3>'+teamRecentForm(data.match?.home,data.match?.homeId,data.match?.id)+'</section><section><h3>Forme récente · '+safe(data.match?.away||"Extérieur")+'</h3>'+teamRecentForm(data.match?.away,data.match?.awayId,data.match?.id)+'</section></div>';
 if(key==="h2h")return headToHead(data.match||{});
 if(key==="players")return groups.length?groups.map(g=>'<h4>'+safe(g.team?.displayName||"Équipe")+'</h4><div class="table-wrap"><table><thead><tr><th>Joueur</th><th>Poste</th><th>Statistiques</th></tr></thead><tbody>'+((g.statistics||[]).flatMap(gr=>(gr.athletes||[]).map(p=>'<tr><td>'+safe(p.athlete?.displayName||"—")+'</td><td>'+safe(p.athlete?.position?.abbreviation||"—")+'</td><td>'+safe((p.stats||[]).join(" · ")||"—")+'</td></tr>'))).join('')+'</tbody></table></div>').join(''):'<div class="md-empty">Statistiques individuelles non disponibles.</div>';
 return '<div class="md-overview-grid"><article class="md-info-card"><span class="eyebrow">STATUT</span><b>'+safe(status(data.match||{}))+'</b><p>'+safe(data.match?.venue||"Stade non communiqué")+'</p></article><article class="md-info-card"><span class="eyebrow">INFORMATIONS OFFICIELLES</span><b>'+lineups.length+' compositions</b><p>'+events.length+' événements reçus</p></article></div>';
}
async function openMatch(m){
 const box=$('match-detail');box.dataset.matchId=m.id;$('match-modal').hidden=false;
 box.innerHTML=detailHeader(m)+'<nav class="md-tabs"><button class="active" data-md-tab="overview">Résumé</button><button data-md-tab="stats">Statistiques</button><button data-md-tab="lineups">Compositions</button><button data-md-tab="events">Événements</button><button data-md-tab="players">Joueurs</button><button data-md-tab="form">Forme</button><button data-md-tab="h2h">Face-à-face</button></nav><div class="md-panel" data-md-panel="overview"><div class="md-loading">Chargement des données officielles…</div></div><div class="md-panel" data-md-panel="stats" hidden></div><div class="md-panel" data-md-panel="lineups" hidden></div><div class="md-panel" data-md-panel="events" hidden></div><div class="md-panel" data-md-panel="players" hidden></div><div class="md-panel" data-md-panel="form" hidden></div><div class="md-panel" data-md-panel="h2h" hidden></div>';
 const tabs=[...box.querySelectorAll("[data-md-tab]")],panels=[...box.querySelectorAll("[data-md-panel]")];tabs.forEach(b=>b.onclick=()=>{tabs.forEach(t=>t.classList.toggle("active",t===b));panels.forEach(p=>p.hidden=p.dataset.mdPanel!==b.dataset.mdTab)});
 try{const d=await get(API+m.code+'/summary?event='+encodeURIComponent(m.id)+'&region=fr&lang=fr');if(box.dataset.matchId!==m.id)return;const latest=matchFromSummary(d,m);Object.assign(m,latest);render();renderLive();renderPicks();renderVIP();renderPersonalizedHome();box.querySelector(".md-head").outerHTML=detailHeader(m);const data={...d,match:m};for(const k of ["overview","stats","lineups","events","players","form","h2h"])box.querySelector('[data-md-panel="'+k+'"]').innerHTML=mdPanel(data,k)}
 catch(e){if(box.dataset.matchId!==m.id)return;for(const k of ["overview","stats","lineups","events","players","form","h2h"])box.querySelector('[data-md-panel="'+k+'"]').innerHTML='<div class="md-empty">Les informations détaillées ne sont pas accessibles auprès de la source pour le moment.</div>'}
}
function xtext(x){return x.text||x.shortText||x.type?.text||x.type?.name||'Événement'}
function recent(team,exclude,venue=null,teamId=null){
 return matches.filter(x=>{
  if(!x.finished||x.id===exclude||x.homeScore===null||x.awayScore===null)return false;
  const sameHome=teamId&&x.homeId?String(x.homeId)===String(teamId):x.home===team;
  const sameAway=teamId&&x.awayId?String(x.awayId)===String(teamId):x.away===team;
  return venue==='home'?sameHome:venue==='away'?sameAway:sameHome||sameAway;
 }).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
}
function points(m,team){const home=m.home===team,sc=Number(home?m.homeScore:m.awayScore),op=Number(home?m.awayScore:m.homeScore);return sc>op?3:sc===op?1:0}
function dateKeyInAppZone(value){const prefs=readAppSettings(),zone=prefs.timezone||'Africa/Porto-Novo';try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+p.month+p.day}catch(e){return dateKey(value)}}
function matchStats(list,team){
 const sample=list.slice(0,8),n=sample.length;
 if(!n)return null;
 let pts=0,wins=0,draws=0,losses=0,scored=0,conceded=0,over15=0,over25=0,btts=0;
 for(const m of sample){const home=m.home===team,forGoals=Number(home?m.homeScore:m.awayScore),against=Number(home?m.awayScore:m.homeScore);scored+=forGoals;conceded+=against;const p=points(m,team);pts+=p;if(p===3)wins++;else if(p===1)draws++;else losses++;const total=forGoals+against;if(total>=2)over15++;if(total>=3)over25++;if(forGoals>0&&against>0)btts++}
 return {sample,n,ppg:pts/n,winRate:wins/n,drawRate:draws/n,unbeatenRate:(wins+draws)/n,scored:scored/n,conceded:conceded/n,goals:(scored+conceded)/n,over15:over15/n,over25:over25/n,bttsRate:btts/n};
}
function marketLine(label,value,detail,kind){
 return '<div class="pick-market"><div><b>'+safe(label)+'</b><small>'+safe(detail)+'</small></div><strong class="'+(kind||'')+'">'+safe(value)+'</strong></div>';
}
const CORNER_CACHE_KEY='gold-pronos-corner-cache-v2';
function readCornerCache(){try{return JSON.parse(localStorage.getItem(CORNER_CACHE_KEY)||'{}')}catch(e){return {}}}
function saveCornerCache(cache){try{localStorage.setItem(CORNER_CACHE_KEY,JSON.stringify(cache))}catch(e){}}
async function cornerHistory(teamMatches){
 const cache=readCornerCache(),now=Date.now(),chosen=teamMatches.slice(0,8),totals=[],missing=[];
 for(const m of chosen){
  if(!m?.code||!m?.id)continue;
  const key=String(m.id),entry=cache[key],age=entry?now-Number(entry.at||0):Infinity;
  const verified=entry?.verified===true||(entry?.verified===undefined&&Number.isFinite(Number(entry?.total)));
  if(entry&&verified&&age<7*86400000&&Number.isFinite(Number(entry.total))){totals.push(Number(entry.total));continue}
  if(entry&&entry.verified===false&&age<6*3600000)continue;
  missing.push({id:key.replace(/^espn-/,''),competition:m.code,key});
 }
 if(!missing.length)return totals;
 const db=window.GoldSupabase;if(!db?.functions?.invoke)return totals;
 try{
  const {data,error}=await withTimeout(db.functions.invoke('corner-history',{body:{matches:missing.map(x=>({id:x.id,competition:x.competition}))}}),10000,'Délai de vérification des corners dépassé');
  if(error)throw error;
  const returned=new Set();
  for(const item of data?.matches||[]){
   const request=missing.find(x=>x.id===String(item.id)&&x.competition===item.competition);
   if(!request)continue;
   returned.add(request.key);
   if(item.verified!==true||!Number.isFinite(Number(item.total))){cache[request.key]={at:now,verified:false};continue}
   const total=Number(item.total);cache[request.key]={at:now,total,verified:true};totals.push(total);
  }
  for(const request of missing)if(!returned.has(request.key))cache[request.key]={at:now,verified:false};
  saveCornerCache(cache);
 }catch(error){console.warn('GOLD PRONOS corner-history:',error?.message||error)}
 return totals;
}
function renderPicks(){
 const box=$('picks');if(!box)return;
 const now=Date.now(),today=dateKeyInAppZone(now);
 const dayMatches=matches.filter(m=>!m.live&&!m.finished&&dateKeyInAppZone(m.date)===today&&new Date(m.date).getTime()>now).sort((a,b)=>new Date(a.date)-new Date(b.date));
 box.replaceChildren();
 const heading=document.createElement('div');heading.className='notice';heading.innerHTML='<b>PRONOSTICS DU JOUR · '+safe(appDate(now,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</b><br>'+dayMatches.length+' rencontre(s) à venir · Sélections calculées à partir des résultats vérifiés disponibles.';box.append(heading);
 if(!dayMatches.length){const empty=document.createElement('div');empty.className='notice';empty.textContent='Aucun match à venir confirmé pour aujourd’hui dans les compétitions suivies. Le calendrier sera actualisé automatiquement.';box.append(empty);return}
 for(const m of dayMatches){
  const h=recent(m.home,m.id),a=recent(m.away,m.id),hs=matchStats(h,m.home),as=matchStats(a,m.away);
  const hHome=recent(m.home,m.id,'home',m.homeId),aAway=recent(m.away,m.id,'away',m.awayId);
  const hhs=matchStats(hHome,m.home),aas=matchStats(aAway,m.away);
  const el=document.createElement('article');el.className='pick-card';
  el.innerHTML='<span class="eyebrow">'+safe(m.league)+'</span><div class="pick-team-heading">'+crestMarkup(m.home,m.homeLogo,m.homeNational?'pick-flag':'pick-crest')+'<h3>'+safe(m.home)+' <span>—</span> '+safe(m.away)+'</h3>'+crestMarkup(m.away,m.awayLogo,m.awayNational?'pick-flag':'pick-crest')+'</div><p><b>Coup d’envoi :</b> '+safe(appDate(m.date,{hour:'2-digit',minute:'2-digit'}))+'</p>';
  if(!hs||!as||hs.n<5||as.n<5||!hhs||!aas||hhs.n<2||aas.n<2){
   el.innerHTML+='<div class="notice"><b>Analyse en attente</b><p>Échantillon insuffisant pour une analyse prudente : 5 résultats récents et 2 résultats dans le contexte domicile/extérieur sont requis par équipe.</p><small>'+h.length+' résultat(s) pour '+safe(m.home)+' · '+a.length+' pour '+safe(m.away)+' · domicile : '+hHome.length+' · extérieur : '+aAway.length+'. Aucun choix ne sera inventé.</small></div>';
   box.append(el);continue;
  }
  const homeForm=hs.ppg*0.35+hhs.ppg*0.65,awayForm=as.ppg*0.35+aas.ppg*0.65;
  const edge=homeForm-awayForm;
  let strong='Aucun favori net',strongWhy='Écart de forme trop faible pour isoler une victoire.';
  if(edge>=0.65){strong='V1 · '+m.home;strongWhy='Indice de forme pondéré : '+homeForm.toFixed(2)+' contre '+awayForm.toFixed(2)+' points par match, avec 65 % de poids au contexte domicile/extérieur.'}
  else if(edge<=-0.65){strong='V2 · '+m.away;strongWhy='Indice de forme pondéré : '+awayForm.toFixed(2)+' contre '+homeForm.toFixed(2)+' points par match, avec 65 % de poids au contexte domicile/extérieur.'}
  let double='Non retenu · prudence',doubleWhy='Aucune différence suffisante dans les taux de matchs sans défaite à domicile et à l’extérieur.';
  if(hhs.unbeatenRate>=0.70&&hhs.unbeatenRate-aas.unbeatenRate>=0.15){double='1X · '+m.home+' ou nul';doubleWhy='Le '+m.home+' est resté sans défaite dans '+Math.round(hhs.unbeatenRate*100)+' % de ses '+hhs.n+' derniers matchs à domicile.'}
  else if(aas.unbeatenRate>=0.70&&aas.unbeatenRate-hhs.unbeatenRate>=0.15){double='X2 · '+m.away+' ou nul';doubleWhy='Le '+m.away+' est resté sans défaite dans '+Math.round(aas.unbeatenRate*100)+' % de ses '+aas.n+' derniers matchs à l’extérieur.'}
  const avgGoals=(hhs.scored+aas.conceded+aas.scored+hhs.conceded)/2;
  const rate15=(hhs.over15+aas.over15)/2,rate25=(hhs.over25+aas.over25)/2;
  const bttsRate=(hhs.bttsRate+aas.bttsRate)/2;
  const goals15=avgGoals>=2.0&&rate15>=0.65?'+ de 1,5 but':'Non retenu · prudence';
  const goals25=avgGoals>=2.65&&rate25>=0.55?'+ de 2,5 buts':'Non retenu · prudence';
  const btts=bttsRate>=0.65&&avgGoals>=2.2?'Oui · signal statistique':'Non retenu · prudence';
  const sampleLabel=Math.min(hs.n,as.n)>=5&&Math.min(hhs.n,aas.n)>=3?'Échantillon exploitable':'Échantillon limité';
  el.innerHTML+='<div class="pick-markets">'+
   marketLine('Équipe la plus forte',strong,strongWhy,strong!=='Aucun favori net'?'market-positive':'market-neutral')+
   marketLine('Double chance',double,doubleWhy,double.startsWith('Non retenu')?'market-neutral':'market-positive')+
   marketLine('Total de buts · 1,5',goals15,'Total attendu indicatif : '+avgGoals.toFixed(2)+' but(s) · fréquence observée : '+Math.round(rate15*100)+'% dans les échantillons domicile/extérieur.',goals15.startsWith('+')?'market-positive':'market-neutral')+
   marketLine('Total de buts · 2,5',goals25,'Fréquence observée : '+Math.round(rate25*100)+'% sur les échantillons domicile/extérieur.',goals25.startsWith('+')?'market-positive':'market-neutral')+
   marketLine('Les deux équipes marquent',btts,'Fréquence observée : '+Math.round(bttsRate*100)+'% sur les échantillons domicile/extérieur.',btts.startsWith('Oui')?'market-positive':'market-neutral')+
   '<div class="pick-market" data-corners><div><b>Total corners · 5,5</b><small>Recherche des statistiques officielles des derniers matchs…</small></div><strong>Vérification</strong></div>'+
   '</div><div class="pick-evidence"><b>Éléments vérifiés</b><p>'+safe(m.home)+' : '+hs.n+' matchs récents · '+hs.ppg.toFixed(2)+' pts/match · '+hs.scored.toFixed(2)+' but(s) marqués et '+hs.conceded.toFixed(2)+' encaissés en moyenne. À domicile : '+hhs.n+' matchs · '+hhs.ppg.toFixed(2)+' pts/match.</p><p>'+safe(m.away)+' : '+as.n+' matchs récents · '+as.ppg.toFixed(2)+' pts/match · '+as.scored.toFixed(2)+' but(s) marqués et '+as.conceded.toFixed(2)+' encaissés en moyenne. À l’extérieur : '+aas.n+' matchs · '+aas.ppg.toFixed(2)+' pts/match.</p><small>'+sampleLabel+' · Fréquences observées, non probabilités garanties. Calcul indicatif fondé sur les résultats disponibles.</small></div>';
  const aiBox=document.createElement('div');
  aiBox.className='pick-ai-check';
  aiBox.innerHTML='<button type="button" class="ghost" data-ai-check>Comparer avec 3 modèles IA</button><div class="pick-ai-result" data-ai-result aria-live="polite"></div>';
  el.append(aiBox);
  aiBox.querySelector('[data-ai-check]').addEventListener('click',async()=>{
   const button=aiBox.querySelector('[data-ai-check]'),result=aiBox.querySelector('[data-ai-result]');
   const db=window.GoldSupabase;
   if(!db){result.textContent='Service de compte indisponible. Actualise l’application.';return}
   const {data:{session}}=await db.auth.getSession();
   if(!session){result.textContent='Connecte-toi à ton compte pour lancer la comparaison IA.';$('account-open')?.click();return}
   button.disabled=true;button.textContent='Comparaison des modèles en cours…';result.textContent='Les modèles analysent les mêmes données vérifiées. Aucun pari n’est garanti.';
   const payload={
    fixture:{home:m.home,away:m.away,competition:m.league,kickoff:m.date},
    evidence:{
     home:{sample:hs.n,pointsPerMatch:Number(hs.ppg.toFixed(2)),goalsScoredAverage:Number(hs.scored.toFixed(2)),goalsConcededAverage:Number(hs.conceded.toFixed(2)),over15Rate:Number(hs.over15.toFixed(3)),over25Rate:Number(hs.over25.toFixed(3)),homeSample:hhs.n,homePointsPerMatch:Number(hhs.ppg.toFixed(2)),homeUnbeatenRate:Number(hhs.unbeatenRate.toFixed(3)),homeBttsRate:Number(hhs.bttsRate.toFixed(3))},
     away:{sample:as.n,pointsPerMatch:Number(as.ppg.toFixed(2)),goalsScoredAverage:Number(as.scored.toFixed(2)),goalsConcededAverage:Number(as.conceded.toFixed(2)),over15Rate:Number(as.over15.toFixed(3)),over25Rate:Number(as.over25.toFixed(3)),awaySample:aas.n,awayPointsPerMatch:Number(aas.ppg.toFixed(2)),awayUnbeatenRate:Number(aas.unbeatenRate.toFixed(3)),awayBttsRate:Number(aas.bttsRate.toFixed(3))}
    },
    markets:[
     {name:'Équipe la plus forte',options:['V1','V2','NO_BET'],current:strong},
     {name:'Double chance',options:['1X','X2','NO_BET'],current:double.startsWith('1X')?'1X':double.startsWith('X2')?'X2':'NO_BET'},
     {name:'Total buts 1.5',options:['OVER_1_5','NO_BET'],current:goals15.startsWith('+')?'OVER_1_5':'NO_BET'},
     {name:'Total buts 2.5',options:['OVER_2_5','NO_BET'],current:goals25.startsWith('+')?'OVER_2_5':'NO_BET'},
     {name:'Les deux équipes marquent',options:['BTTS_YES','NO_BET'],current:btts.startsWith('Oui')?'BTTS_YES':'NO_BET'}
    ]
   };
   try{
    const {data,error}=await db.functions.invoke('ai-crosscheck',{body:payload});
    if(error)throw error;
    if(!data?.verified){result.textContent=data?.message||'La comparaison n’a pas pu être validée.';return}
    const rows=(data.consensus||[]).map(x=>x.market+' : '+x.pick+' ('+x.agreement+' modèles d’accord)');
    result.textContent='Comparaison multi-IA · '+data.successfulModels+'/3 modèles\n'+rows.join('\n')+'\n'+data.disclaimer;
   }catch(error){
    let message=error?.message||'Erreur de connexion.';
    try{const body=await error.context?.json?.();if(body?.message)message=body.message;if(body?.code==='AI_NOT_CONFIGURED')message='Clé IA non configurée dans Supabase. Ajoute OPENROUTER_API_KEY dans les secrets du projet.'}catch(_){}
    result.textContent='Comparaison indisponible : '+message;
   }finally{button.disabled=false;button.textContent='Relancer la comparaison IA'}
  });
  box.append(el);
  const cornerNode=el.querySelector('[data-corners]');
  const cornerTimer=setTimeout(()=>{if(cornerNode.isConnected&&cornerNode.querySelector('small')?.textContent.includes('Recherche'))cornerNode.innerHTML='<div><b>Total corners · 5,5</b><small>La source met trop de temps à répondre. Relance les pronostics pour réessayer.</small></div><strong>Vérification interrompue</strong>'},14000);
  cornerHistory([...h.slice(0,4),...a.slice(0,4)]).then(all=>{
   clearTimeout(cornerTimer);
   if(!cornerNode.isConnected)return;
   if(all.length<4){cornerNode.innerHTML='<div><b>Total corners · 5,5</b><small>Statistiques de corners non publiées ou échantillon insuffisant par la source pour cette rencontre.</small></div><strong>Non disponible</strong>';return}
   const avg=all.reduce((sum,v)=>sum+v,0)/all.length;
   const hit=all.filter(v=>v>=6).length/all.length;
   const pick=avg>=7&&hit>=0.6?'+ de 5,5 corners':'Non retenu · prudence';
   cornerNode.innerHTML='<div><b>Total corners · 5,5</b><small>Moyenne observée : '+avg.toFixed(1)+' · '+Math.round(hit*100)+'% des matchs avec 6 corners ou plus · '+all.length+' observations.</small></div><strong class="'+(pick.startsWith('+')?'market-positive':'market-neutral')+'">'+pick+'</strong>';
  }).catch(()=>{clearTimeout(cornerTimer);if(cornerNode.isConnected)cornerNode.innerHTML='<div><b>Total corners · 5,5</b><small>Impossible de vérifier cette statistique auprès de la source.</small></div><strong>Non disponible</strong>'});
 }
}
function findRows(obj,out=[],seen=new Set()){
 if(!obj||typeof obj!=='object'||seen.has(obj))return out;seen.add(obj);
 if(Array.isArray(obj)){for(const x of obj)findRows(x,out,seen);return out}
 if(obj.team&&(obj.stats||obj.statsSummary||obj.rank||obj.position||obj.team.displayName||obj.team.name))out.push(obj);
 if(Array.isArray(obj.entries))for(const e of obj.entries)if(e?.team)out.push(e);
 for(const [k,v] of Object.entries(obj)){if(v&&typeof v==='object'&&k!=='team')findRows(v,out,seen)}
 return out;
}
function standingsRows(data){
 const found=findRows(data),map=new Map();
 for(const e of found){const id=e.team?.id||e.team?.uid||teamName(e);if(id&&!map.has(String(id)))map.set(String(id),e)}
 return [...map.values()].filter(e=>teamName(e)!=='Club non renseigné');
}
function stat(e,names){
 const s=e.stats||e.statsSummary||e.statistics||[];
 const aliases={gamesplayed:['gamesplayed','played','gp','mp'],wins:['wins','win','w'],ties:['ties','draw','draws','d'],losses:['losses','loss','l'],pointsfor:['pointsfor','goalsfor','gf','for'],pointsagainst:['pointsagainst','goalsagainst','ga','against'],points:['points','pts']};
 const wanted=names.flatMap(n=>aliases[n]||[n]).map(x=>x.toLowerCase());
 const arr=Array.isArray(s)?s:Object.entries(s).map(([name,value])=>({name,value}));
 for(const x of arr){const key=String(x.name||x.abbreviation||x.type||x.shortDisplayName||x.displayName||'').toLowerCase().replace(/[^a-z]/g,'');if(wanted.some(n=>key===n.replace(/[^a-z]/g,'')))return x.displayValue??x.value??x.display??'—'}
 return '—';
}
function teamName(e){return e.team?.displayName||e.team?.name||e.team?.shortDisplayName||e.team?.abbreviation||'Club non renseigné'}
function normaliseLeaderGroups(data){
 let groups=Array.isArray(data?.leaders)?data.leaders:Array.isArray(data?.categories)?data.categories:[];
 if(!groups.length&&data?.leaders&&typeof data.leaders==='object')groups=Object.values(data.leaders);
 return groups.map(g=>({...g,leaders:Array.isArray(g.leaders)?g.leaders:Array.isArray(g.leader)?g.leader:g.leaders?.athletes||g.leader?.athletes||[]})).filter(g=>g.leaders.length);
}
async function loadStandings(){
 const code=$('standings-league').value,box=$('standings');activeLeague=code;
 box.innerHTML='<div class="loading">Chargement du classement officiel…</div>';
 try{
  let data=null,rows=[];
  const urls=[
   'https://site.api.espn.com/apis/v2/sports/soccer/'+encodeURIComponent(code)+'/standings',
   'https://site.web.api.espn.com/apis/v2/sports/soccer/'+encodeURIComponent(code)+'/standings'
  ];
  let lastError=null;
  for(const url of urls){
   try{data=await get(url,15000);rows=standingsRows(data);if(rows.length)break}
   catch(error){lastError=error}
  }
  if(!rows.length)throw lastError||Error('Aucune table officielle publiée par la source pour cette compétition');
  rows.sort((a,b)=>{
   const rank=e=>Number(e.rank??e.position??e.stats?.find?.(x=>/rank|position/i.test(x.name||''))?.value??999);
   return rank(a)-rank(b);
  });
  const html='<div class="table-wrap"><table><thead><tr><th>#</th><th>Club</th><th>MJ</th><th>V</th><th>N</th><th>D</th><th>BP</th><th>BC</th><th>Pts</th></tr></thead><tbody>'+rows.map((e,i)=>'<tr><td>'+(e.rank??e.position??(stat(e,['rank'])!=='—'?stat(e,['rank']):i+1))+'</td><td><span class="standing-team">'+crestMarkup(teamName(e),isNationalCompetition(code)?teamFlagUrl(e.team):crestUrl(e.team),isNationalCompetition(code)?'standing-flag':'standing-crest')+'<b>'+safe(teamName(e))+'</b></span></td><td>'+stat(e,['gamesplayed'])+'</td><td>'+stat(e,['wins'])+'</td><td>'+stat(e,['ties'])+'</td><td>'+stat(e,['losses'])+'</td><td>'+stat(e,['pointsfor'])+'</td><td>'+stat(e,['pointsagainst'])+'</td><td><b>'+stat(e,['points'])+'</b></td></tr>').join('')+'</tbody></table></div><p class="muted">Source : ESPN · Classement officiel · '+new Date().toLocaleString(appLocale())+'</p>';
  box.innerHTML=html;
 }catch(e){box.innerHTML='<div class="notice">Le fournisseur ne publie pas de classement officiel exploitable pour cette compétition actuellement. Choisis une compétition dont la table officielle est disponible. Aucun classement estimé ne sera présenté comme officiel.</div>'}
}
function renderTeamCatalog(unique,code,box,stale=false){
 const national=isNationalCompetition(code);
 box.innerHTML=(stale?'<div class="notice">Source momentanément indisponible : affichage du dernier catalogue officiel enregistré sur cet appareil.</div>':'')+unique.map(t=>{const name=t.displayName||t.name||'Équipe',logo=national?teamFlagUrl(t):crestUrl(t),kind=national?'flag-crest':'crest';return '<article class="team-tile"><div class="team-crest-wrap">'+crestMarkup(name,logo,kind)+'</div><b>'+safe(name)+'</b><small>'+safe(t.location||t.country?.name||'')+'</small><span class="team-source-label">'+(national?(logo?'DRAPEAU NATIONAL':'DRAPEAU NON FOURNI'):(logo?'ÉCUSSON FOURNI':'IDENTITÉ DU CLUB'))+'</span><button type="button" class="team-open" data-team="'+safe(t.id)+'" data-code="'+safe(code)+'">Voir la fiche</button><button type="button" class="team-fav" data-fav-team="'+safe(t.id)+'" data-name="'+safe(name)+'">☆ Ajouter aux favoris</button></article>'}).join('');
 box.querySelectorAll('.team-open').forEach(b=>b.onclick=()=>loadTeamProfile(b.dataset.code,b.dataset.team));
 box.querySelectorAll('[data-fav-team]').forEach(b=>b.onclick=()=>toggleFavorite('favorite_teams','team_id',b.dataset.favTeam,b.dataset.name));
}
async function loadTeams(){
 const code=$('teams-competition')?.value,box=$('teams-list'),profile=$('team-profile');if(!code||!box)return;
 profile.innerHTML='';box.innerHTML='<div class="loading">Chargement des clubs et sélections…</div>';
 const cacheKey='gold-pronos-team-catalog-'+code;
 try{
  const db=window.GoldSupabase;if(!db)throw Error('Service sécurisé des équipes indisponible');
  const {data:d,error}=await withTimeout(db.functions.invoke('teams-catalog',{body:{competition:code}}),18000,'Le catalogue des équipes ne répond pas dans le délai prévu.');
  if(error)throw error;
  const rows=d?.teams||[];
  const unique=[...new Map(rows.map(t=>[String(t.id),t])).values()];
  if(!unique.length)throw Error('Aucune équipe fournie pour cette compétition');
  try{localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),teams:unique}))}catch(_){}
  renderTeamCatalog(unique,code,box,false);
 }catch(e){
  let cached=null;try{cached=JSON.parse(localStorage.getItem(cacheKey)||'null')}catch(_){}
  if(Array.isArray(cached?.teams)&&cached.teams.length)renderTeamCatalog(cached.teams,code,box,true);
  else box.innerHTML='<div class="notice">Impossible de charger les équipes officielles pour le moment. '+safe(e?.message||'Le fournisseur ne répond pas.')+' Réessaie dans quelques instants. Aucune équipe ni image fictive ne sera affichée.</div>';
 }
}
async function loadTeamProfile(code,id){
 const box=$('team-profile');box.innerHTML='<div class="loading">Chargement de la fiche officielle, du stade et de l’effectif…</div>';
 try{
  const db=window.GoldSupabase;if(!db)throw Error('Service sécurisé des fiches équipes indisponible');
  const {data,error}=await withTimeout(db.functions.invoke('team-profile',{body:{competition:code,teamId:String(id)}}),22000,'La fiche équipe met trop de temps à répondre.');
  if(error)throw error;
  if(!data)throw Error('La source officielle n’a retourné aucune fiche');
  const team=data.team||{},list=Array.isArray(data.athletes)?data.athletes:[],rejectedRoster=Number(data.rejected_roster_entries||0);
  const venue=team.franchise?.venue||team.venue||team.homeVenue||{};
  const national=isNationalCompetition(code);
  const logo=national?teamFlagUrl(team):crestUrl(team);
  const name=team.displayName||team.name||team.shortDisplayName||'Équipe';
  const value=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='');
  const facts=[
   ['Ville',value(team.location,team.franchise?.location)],
   ['Pays',value(team.country?.name,team.country?.displayName,team.country)],
   ['Surnom',value(team.nickname,team.shortName)],
   ['Fondation',value(team.foundingDate,team.founded,team.established,team.franchise?.founded)],
   ['Première saison',value(team.firstYearOfPlay,team.franchise?.firstYearOfPlay)],
   ['Couleurs',value(team.color&&('#'+team.color),team.alternateColor&&('#'+team.alternateColor))],
   ['Entraîneur',value(team.coach?.fullName,team.coaches?.[0]?.fullName)],
   ['Compétition',value(team.groups?.[0]?.name,team.league?.name)]
  ].filter(x=>x[1]);
  const stadium=[
   ['Stade',value(venue.fullName,venue.displayName,venue.name,team.franchise?.venueName)],
   ['Ville du stade',value(venue.address?.city,venue.city,venue.location)],
   ['Capacité',value(venue.capacity,venue.seatingCapacity)],
   ['Surface',value(venue.grass,venue.surface)]
  ].filter(x=>x[1]);
  const history=[
   ['Fondé',value(team.foundingDate,team.founded,team.established,team.franchise?.founded)],
   ['Première saison',value(team.firstYearOfPlay,team.franchise?.firstYearOfPlay)],
   ['Palmarès',Array.isArray(team.honors)?team.honors.length+' distinction(s) répertoriée(s)':null]
  ].filter(x=>x[1]);
  const honours=Array.isArray(team.honors)?team.honors:(Array.isArray(team.achievements)?team.achievements:[]);
  const esc=x=>safe(String(x));
  const factsHtml=facts.length?'<div class="team-facts">'+facts.map(x=>'<div><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join('')+'</div>':'<p class="notice">Les données biographiques officielles ne sont pas détaillées par le fournisseur pour cette équipe.</p>';
  const stadiumHtml='<h4>Stade et enceinte</h4>'+(stadium.length?'<div class="team-facts">'+stadium.map(x=>'<div><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join('')+'</div>':'<p class="notice">Le stade n’est pas renseigné dans la fiche officielle disponible. Nous ne lui attribuons pas de stade supposé.</p>');
  const historyHtml='<h4>Historique du club</h4>'+(history.length?'<div class="team-facts">'+history.map(x=>'<div><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join('')+'</div>':'<p class="notice">La date de fondation et les repères historiques ne sont pas publiés dans la fiche fournisseur pour cette équipe.</p>');
  box.innerHTML='<article class="team-profile-card"><div class="team-profile-head">'+crestMarkup(name,logo,national?'profile-flag':'profile-crest')+'<div><span class="eyebrow">FICHE ÉQUIPE · EFFECTIF ESPN · PHOTOS '+esc(data.photo_source||"ESPN")+'</span><h3>'+esc(name)+'</h3><p>'+esc(value(team.abbreviation,team.location,'')||'')+'</p></div></div>'+factsHtml+historyHtml+stadiumHtml+(honours.length?'<h4>Palmarès communiqué</h4><ul>'+honours.map(x=>'<li>'+esc(x.name||x.description||x.title||x)+'</li>').join('')+'</ul>':'')+'<h4>Effectif et photos des joueurs</h4>'+(rejectedRoster?'<div class="notice">'+rejectedRoster+' entrée(s) de joueurs ont été écartées car leur appartenance au club n’a pas pu être confirmée.</div>':'')+(list.length?'<div class="player-grid">'+list.map(p=>{const a=p.athlete||p,photo=a.headshot?.href||a.photo||a.image||'';return '<div class="player-tile">'+(photo?'<img loading="lazy" src="'+esc(photo)+'" alt="Photo de '+esc(a.displayName||a.fullName||'joueur')+'">':'<div class="player-no-photo">Photo non fournie</div>')+'<b>'+esc(a.displayName||a.fullName||a.name||'Joueur')+'</b><small>'+esc(a.position?.displayName||a.position?.name||a.position?.abbreviation||'')+'</small></div>'}).join('')+'</div>':'<div class="notice">L’effectif détaillé ou les photos ne sont pas publiés par la source pour cette équipe.</div>')+'</article>';
  box.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){box.innerHTML='<div class="notice">Impossible de charger la fiche officielle de cette équipe. '+safe(e?.message||'Le fournisseur ne répond pas.')+' Aucune information historique ou de stade ne sera inventée.</div>'}
}
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
async function currentUser(){const db=window.GoldSupabase;if(!db)return null;const r=await db.auth.getUser();return r.data?.user||null}
async function toggleFavorite(table,key,value,name){
 const db=window.GoldSupabase,user=await currentUser();if(!db||!user){toast('Connecte-toi pour enregistrer tes favoris.');$('account-open').click();return}
 const found=await db.from(table).select('id').eq('user_id',user.id).eq(key,String(value)).maybeSingle();
 if(found.error){toast('Impossible de vérifier ce favori.');return}
 if(found.data){const del=await db.from(table).delete().eq('id',found.data.id);if(del.error){toast('Suppression impossible.');return}toast('Favori retiré.')}
 else{const payload={user_id:user.id,[key]:String(value),[table==='favorite_teams'?'team_name':'competition_name']:name};const ins=await db.from(table).insert(payload);if(ins.error){toast('Enregistrement impossible : '+ins.error.message);return}toast('Ajouté aux favoris.')}
 await loadAccountFeatures();
}
async function loadAccountFeatures(){
 const db=window.GoldSupabase,user=await currentUser();if(!db||!user)return;
 const [teams,comps,pref]=await Promise.all([
  db.from('favorite_teams').select('id,team_id,team_name').eq('user_id',user.id).order('created_at',{ascending:false}),
  db.from('favorite_competitions').select('id,competition_id,competition_name').eq('user_id',user.id).order('created_at',{ascending:false}),
  db.from('notification_preferences').select('*').eq('user_id',user.id).maybeSingle()
 ]);
 const tf=$('account-fav-teams'),cf=$('account-fav-comps');
 if(tf)tf.innerHTML=teams.error?'<p class="muted">Favoris momentanément indisponibles.</p>':(teams.data||[]).length?(teams.data||[]).map(x=>{const m=matches.find(z=>String(z.homeId)===String(x.team_id)||String(z.awayId)===String(x.team_id));const logo=m?(String(m.homeId)===String(x.team_id)?m.homeLogo:m.awayLogo):'';return '<div class="favorite-row"><span class="favorite-team-name">'+crestMarkup(x.team_name,logo,'favorite-crest')+safe(x.team_name)+'</span><button type="button" data-remove-team="'+safe(x.id)+'">Retirer</button></div>'}).join(''):'<p class="muted">Aucun club favori pour le moment. Ajoute-en depuis la page Clubs & sélections.</p>';
 if(cf)cf.innerHTML=comps.error?'<p class="muted">Favoris momentanément indisponibles.</p>':(comps.data||[]).length?(comps.data||[]).map(x=>'<div class="favorite-row"><span>'+safe(x.competition_name)+'</span><button type="button" data-remove-comp="'+safe(x.id)+'">Retirer</button></div>').join(''):'<p class="muted">Aucune compétition favorite pour le moment.</p>';
 tf?.querySelectorAll('[data-remove-team]').forEach(b=>b.onclick=async()=>{await db.from('favorite_teams').delete().eq('id',b.dataset.removeTeam);loadAccountFeatures()});
 cf?.querySelectorAll('[data-remove-comp]').forEach(b=>b.onclick=async()=>{await db.from('favorite_competitions').delete().eq('id',b.dataset.removeComp);loadAccountFeatures()});
 const p=pref.data||{kickoff:true,goals:true,fulltime:true,halftime_fulltime:true,reminder_minutes:15};[['pref-notifications','enabled'],['pref-kickoff','kickoff'],['pref-goals','goals'],['pref-halftime','halftime'],['pref-fulltime','fulltime'],['pref-lineups','lineups'],['pref-redcards','red_cards'],['pref-penalties','penalties'],['pref-substitutions','substitutions'],['pref-reminders','match_reminders'],['pref-favorites-only','favorite_teams_only']].forEach(([id,k])=>{const el=$(id);if(el)el.checked=!!p[k]});const mins=$('pref-reminder-minutes');if(mins)mins.value=String(p.reminder_minutes||15);
}
function vapidKeyBytes(value){
 const base64=String(value).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64+'='.repeat((4-base64.length%4)%4));
 return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
}
async function enableBackgroundPush(){
 const status=$('push-status'),button=$('enable-background-push'),db=window.GoldSupabase;
 if(!db){if(status)status.textContent='Service de compte indisponible.';return}
 const user=await currentUser();if(!user){if(status)status.textContent='Connecte-toi à ton compte avant d’activer les notifications.';$('account-open')?.click();return}
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){if(status)status.textContent='Ce navigateur ne prend pas en charge les notifications web push. Utilise Chrome et installe GOLD PRONOS comme application.';return}
 if(!window.isSecureContext){if(status)status.textContent='Les notifications nécessitent une connexion HTTPS.';return}
 button.disabled=true;if(status)status.textContent='Vérification de la configuration sécurisée…';
 try{
  const {data:cfg,error:cfgError}=await db.functions.invoke('push-config',{method:'GET'});
  if(cfgError)throw cfgError;
  if(!cfg?.configured||!cfg.publicKey){if(status)status.textContent='Configuration incomplète : les clés VAPID doivent être ajoutées dans Supabase Secrets avant l’activation.';return}
  let permission=Notification.permission;if(permission==='default')permission=await Notification.requestPermission();
  if(permission!=='granted'){if(status)status.textContent='Autorisation de notification refusée sur cet appareil.';return}
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKeyBytes(cfg.publicKey)});
  const data=subscription.toJSON(),keys=data.keys||{};
  const {error}=await db.from('push_subscriptions').upsert({user_id:user.id,endpoint:subscription.endpoint,p256dh:keys.p256dh,auth:keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  if(error)throw error;
  const {error:prefError}=await db.from('notification_preferences').upsert({user_id:user.id,enabled:true,timezone:readAppSettings().timezone||'Africa/Porto-Novo',updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(prefError)throw prefError;
  await loadAccountFeatures();
  if(status)status.textContent='Notifications en arrière-plan activées. Les événements sont surveillés automatiquement chaque minute. Tu peux personnaliser les alertes dans les paramètres.';
  toast('Abonnement push et alertes serveur activés.');
 }catch(error){if(status)status.textContent='Activation impossible : '+(error?.message||'Erreur technique.');}
 finally{button.disabled=false}
}
async function saveNotificationPrefs(){
 const db=window.GoldSupabase,user=await currentUser();if(!db||!user){toast('Connecte-toi pour enregistrer ces réglages.');return}
 const enabled=$('pref-notifications').checked;
 if(enabled&&'Notification'in window&&Notification.permission==='default'){const permission=await Notification.requestPermission();if(permission!=='granted'){toast('Autorisation de notification refusée.');$('pref-notifications').checked=false;return}}
 if(enabled&&(!('Notification'in window)||Notification.permission!=='granted')){toast('Les notifications ne sont pas autorisées sur cet appareil.');$('pref-notifications').checked=false;return}
 const payload={user_id:user.id,enabled,kickoff:$('pref-kickoff').checked,goals:$('pref-goals').checked,red_cards:$('pref-redcards').checked,penalties:$('pref-penalties').checked,substitutions:$('pref-substitutions').checked,halftime:$('pref-halftime').checked,fulltime:$('pref-fulltime').checked,halftime_fulltime:$('pref-halftime').checked||$('pref-fulltime').checked,lineups:$('pref-lineups').checked,match_reminders:$('pref-reminders').checked,reminder_minutes:Number($('pref-reminder-minutes').value),favorite_teams_only:$('pref-favorites-only').checked,timezone:readAppSettings().timezone||'Africa/Porto-Novo',updated_at:new Date().toISOString()};
 const {error}=await db.from('notification_preferences').upsert(payload,{onConflict:'user_id'});toast(error?'Impossible d’enregistrer les alertes.':'Préférences d’alertes enregistrées.');
}
const APP_SETTINGS_KEY='gold-pronos-settings-v1';
function readAppSettings(){try{return JSON.parse(localStorage.getItem(APP_SETTINGS_KEY)||'{}')}catch(e){return {}}}
function scheduleRefresh(){if(window.goldPronosRefreshTimer)clearInterval(window.goldPronosRefreshTimer);const ms=Number(readAppSettings().refreshMs)||180000;window.goldPronosRefreshTimer=setInterval(refresh,ms)}
function loadSettings(){const p=readAppSettings();$('settings-language').value=p.language||window.GoldI18n?.getLanguage?.()||'fr';$('settings-timezone').value=p.timezone||'Africa/Porto-Novo';$('settings-refresh').value=String(p.refreshMs||180000);$('settings-status').textContent='Fuseau horaire : '+$('settings-timezone').selectedOptions[0].text+'. Actualisation : '+$('settings-refresh').selectedOptions[0].text+'.'}
function saveSettings(){const p={language:$('settings-language').value,timezone:$('settings-timezone').value,refreshMs:Number($('settings-refresh').value)};localStorage.setItem(APP_SETTINGS_KEY,JSON.stringify(p));window.GoldI18n?.setLanguage?.(p.language);scheduleRefresh();$('settings-status').textContent='Paramètres enregistrés sur cet appareil.';toast('Paramètres enregistrés.')}
function renderVIP(){const box=$('vip-list');if(!box)return;const cards=[...$('picks').querySelectorAll('.pick-card')];box.innerHTML=cards.length?cards.slice(0,5).map(x=>x.outerHTML).join(''):'<div class="notice">Aucune analyse vérifiée ne peut être proposée pour le moment. Reviens lorsque davantage de résultats seront disponibles.</div>';box.querySelectorAll('[data-ai-check]').forEach(button=>{button.textContent='Ouvrir l’analyse complète';button.onclick=()=>document.querySelector('[data-page="pronos"]')?.click()})}
let previousScores=new Map(),previousStatuses=new Map(),previousPeriods=new Map();
async function localMatchAlerts(){
 const db=window.GoldSupabase,user=await currentUser();if(!db||!user||!('Notification'in window)||Notification.permission!=='granted')return;
 const {data:p}=await db.from('notification_preferences').select('*').eq('user_id',user.id).maybeSingle();if(!p?.enabled)return;
 let favIds=[];
 if(p.favorite_teams_only){const fav=await db.from('favorite_teams').select('team_id').eq('user_id',user.id);favIds=(fav.data||[]).map(x=>String(x.team_id));if(!favIds.length)return}
 const registration=await navigator.serviceWorker?.getRegistration();
 const send=(title,body,tag)=>{const options={body,icon:'./icon.svg',tag:'gold-pronos-'+tag};if(registration?.showNotification)registration.showNotification(title,options);else new Notification(title,options)};
 for(const m of matches){
  if(p.favorite_teams_only&&!favIds.includes(String(m.homeId))&&!favIds.includes(String(m.awayId))&&!favIds.includes(m.home)&&!favIds.includes(m.away))continue;
  if(p.match_reminders&&!m.live&&!m.finished){const mins=Number(p.reminder_minutes)||15,diff=new Date(m.date).getTime()-Date.now(),rkey='gold-pronos-reminder-'+m.id;if(diff>0&&diff<=mins*60000&&!localStorage.getItem(rkey)){send('Rappel de match · '+m.home+' – '+m.away,'Le coup d’envoi est prévu dans moins de '+mins+' minutes.',m.id+'-reminder');localStorage.setItem(rkey,'1');}}
  if(p.lineups&&m.lineups?.length&&!m.lineupNotified){send('Compositions officielles · '+m.home+' – '+m.away,'Les titulaires des deux équipes sont publiés. Ouvre la fiche du match.',m.id+'-lineups');m.lineupNotified=true;}
  const oldScore=previousScores.get(m.id),score=m.homeScore+'-'+m.awayScore,oldStatus=previousStatuses.get(m.id);
  const period= /half.?time|mi-temps|break/i.test(String(m.periodDetail||''))?'HALFTIME':'PLAYING';
  const oldPeriod=previousPeriods.get(m.id);
  if(oldScore&&oldScore!==score&&p.goals&&m.homeScore!==null&&m.awayScore!==null)send('But · '+m.home+' – '+m.away,'Nouveau score : '+score,m.id+'-but-'+score);
  if(oldStatus==='SCHEDULED'&&m.live&&p.kickoff)send('Coup d’envoi · '+m.home+' – '+m.away,'Le match vient de commencer.',m.id+'-debut');
  if(oldPeriod==='PLAYING'&&period==='HALFTIME'&&(p.halftime||p.halftime_fulltime))send('Mi-temps · '+m.home+' – '+m.away,'Score à la pause : '+score,m.id+'-halftime');
  if(oldStatus==='LIVE'&&m.finished&&(p.fulltime??p.halftime_fulltime))send('Fin du match · '+m.home+' – '+m.away,'Résultat final : '+score,m.id+'-fulltime');
  previousScores.set(m.id,score);previousStatuses.set(m.id,m.status);previousPeriods.set(m.id,period);
 }
}
async function pollLiveEventAlerts(){
 const db=window.GoldSupabase,user=await currentUser();if(!db||!user||!('Notification'in window)||Notification.permission!=='granted')return;
 const {data:p}=await db.from('notification_preferences').select('*').eq('user_id',user.id).maybeSingle();
 if(!p?.enabled||(!p.red_cards&&!p.penalties&&!p.substitutions))return;
 let favIds=[];if(p.favorite_teams_only){const fav=await db.from('favorite_teams').select('team_id').eq('user_id',user.id);favIds=(fav.data||[]).map(x=>String(x.team_id));if(!favIds.length)return}
 const reg=await navigator.serviceWorker?.getRegistration();const send=(title,body,tag)=>{const options={body,icon:'./icon.svg',tag:'gold-pronos-'+tag};if(reg?.showNotification)reg.showNotification(title,options);else new Notification(title,options)};
 let seen=[];try{seen=JSON.parse(localStorage.getItem('gold-pronos-seen-events-v1')||'[]')}catch(e){}const seenSet=new Set(seen);const baseline=localStorage.getItem('gold-pronos-event-baseline-v1')==='1';let changed=false;
 for(const m of matches.filter(x=>x.live).slice(0,10)){
  if(p.favorite_teams_only&&!favIds.includes(String(m.homeId))&&!favIds.includes(String(m.awayId))&&!favIds.includes(m.home)&&!favIds.includes(m.away))continue;
  try{const d=await get(API+m.code+'/summary?event='+encodeURIComponent(m.id)+'&region=fr&lang=fr',9000);const plays=d.commentary?.items||d.plays||[];for(const x of plays){const desc=String(xtext(x)+' '+(x.type?.text||x.type?.name||'')).toLowerCase();const key=m.id+':'+String(x.id||x.sequenceNumber||x.sequence||desc+'-'+(x.clock?.displayValue||x.time||''));if(seenSet.has(key))continue;seenSet.add(key);changed=true;if(!baseline)continue;
   if(p.red_cards&&/(red card|carton rouge|second yellow.*card|second jaune)/i.test(desc))send('Carton rouge · '+m.home+' – '+m.away,String(xtext(x)),key);
   else if(p.penalties&&/(penalt|penalty|tir au but|coup de pied de réparation)/i.test(desc))send('Penalty · '+m.home+' – '+m.away,String(xtext(x)),key);
   else if(p.substitutions&&/(substitution|substituted|remplacement|remplace par|enters the match)/i.test(desc))send('Remplacement · '+m.home+' – '+m.away,String(xtext(x)),key);
  }}catch(e){}
 }
 if(changed){localStorage.setItem('gold-pronos-seen-events-v1',JSON.stringify([...seenSet].slice(-500)));if(!baseline)localStorage.setItem('gold-pronos-event-baseline-v1','1')}
}
async function loadCommunity(){
 const root=$('community-app');if(!root)return;
 const db=window.GoldSupabase;
 if(!db){root.innerHTML='<div class="notice">Le service de compte se charge. Actualise la page dans quelques secondes.</div>';return}
 root.innerHTML='<div class="loading">Chargement des discussions…</div>';
 try{
  const [{data:posts,error},{data:{user}}]=await Promise.all([db.from('community_posts').select('id,title,body,created_at').eq('status','published').order('created_at',{ascending:false}).limit(40),db.auth.getUser()]);
  if(error)throw error;
  const ids=(posts||[]).map(p=>p.id);let comments=[];
  if(ids.length){const r=await db.from('community_comments').select('id,post_id,body,created_at').eq('status','published').in('post_id',ids).order('created_at',{ascending:true});if(r.error)throw r.error;comments=r.data||[]}
  const feed=(posts||[]).map(p=>'<article class="community-post"><h3>'+safe(p.title)+'</h3><p>'+safe(p.body)+'</p><small>Publié le '+safe(appDate(p.created_at,{dateStyle:'medium',timeStyle:'short'}))+'</small><button type="button" class="report-content" data-report-post="'+p.id+'">Signaler cette discussion</button><div class="community-comments">'+comments.filter(x=>x.post_id===p.id).map(x=>'<p>'+safe(x.body)+' <button type="button" class="report-content" data-report-comment="'+x.id+'">Signaler</button></p>').join('')+'</div><form class="community-comment-form" data-post="'+p.id+'"><input name="body" maxlength="1000" placeholder="Écrire un commentaire…" required '+(user?'':'disabled')+'><button type="submit" '+(user?'':'disabled')+'>Répondre</button></form></article>').join('');
  root.innerHTML='<div class="community-compose"><h3>Nouvelle discussion</h3>'+(user?'<form id="community-post-form"><input id="community-title" maxlength="120" placeholder="Titre de ta discussion" required><textarea id="community-body" maxlength="3000" rows="4" placeholder="Écris ton message…" required></textarea><button type="submit">Publier</button></form>':'<p>Connecte-toi avec ton compte GOLD PRONOS pour publier ou commenter. Les discussions restent consultables librement.</p><button type="button" id="community-login">Mon compte</button>')+'</div><div class="community-feed">'+(feed||'<div class="notice">Aucune discussion pour le moment. Tu peux ouvrir le premier débat.</div>')+'</div><p class="community-refresh"><button type="button" id="community-refresh">Actualiser les discussions</button></p>';
  const login=$('community-login');if(login)login.onclick=()=>$('account-open').click();
  root.querySelectorAll('[data-report-post]').forEach(b=>b.onclick=async()=>{const {data:{user:u}}=await db.auth.getUser();if(!u){toast('Connecte-toi pour signaler un contenu.');return}const {error}=await db.from('community_reports').insert({reporter_id:u.id,post_id:Number(b.dataset.reportPost),reason:'Contenu signalé par un membre pour vérification.'});toast(error?'Signalement impossible.':'Signalement transmis à l’équipe de modération.')});
  root.querySelectorAll('[data-report-comment]').forEach(b=>b.onclick=async()=>{const {data:{user:u}}=await db.auth.getUser();if(!u){toast('Connecte-toi pour signaler un contenu.');return}const {error}=await db.from('community_reports').insert({reporter_id:u.id,comment_id:Number(b.dataset.reportComment),reason:'Commentaire signalé par un membre pour vérification.'});toast(error?'Signalement impossible.':'Signalement transmis à l’équipe de modération.')});
  const pf=$('community-post-form');if(pf)pf.onsubmit=async e=>{e.preventDefault();const title=$('community-title').value.trim(),body=$('community-body').value.trim();if(!title||!body)return;const {data:{user:u}}=await db.auth.getUser();if(!u){alert('Connecte-toi avant de publier.');return}const {error}=await db.from('community_posts').insert({user_id:u.id,title,body});if(error){alert('Publication impossible : '+error.message);return}await loadCommunity()};
  root.querySelectorAll('.community-comment-form').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const body=form.elements.body.value.trim();if(!body)return;const {data:{user:u}}=await db.auth.getUser();if(!u){alert('Connecte-toi avant de commenter.');return}const {error}=await db.from('community_comments').insert({post_id:Number(form.dataset.post),user_id:u.id,body});if(error){alert('Commentaire impossible : '+error.message);return}await loadCommunity()});
  $('community-refresh').onclick=loadCommunity;
 }catch(e){root.innerHTML='<div class="notice">Impossible de charger les discussions. Vérifie ta connexion et réessaie. ('+safe(e.message||'erreur')+')</div>'}
}
async function loadNews(){
 const box=$('news-list');if(!box)return;box.innerHTML='<div class="loading">Recherche des dernières actualités…</div>';
 const endpoints=[API+'eng.1/news?limit=20&region=fr&lang=fr',API+'esp.1/news?limit=20&region=fr&lang=fr',API+'ita.1/news?limit=20&region=fr&lang=fr','https://site.api.espn.com/apis/site/v2/sports/soccer/news?limit=30&region=fr&lang=fr'];
 const responses=await Promise.allSettled(endpoints.map(url=>get(url,10000)));
 const items=responses.flatMap(r=>{if(r.status!=='fulfilled')return [];const d=r.value;return d.articles||d.items||d.feed?.entries||[]});
 const unique=[...new Map(items.map(x=>[String(x.id||x.guid||x.headline||x.title||''),x])).values()];
 if(!unique.length){box.innerHTML='<div class="notice">Le flux d’actualités football est momentanément inaccessible. Réessaie plus tard. Aucun article ni transfert ne sera inventé.</div>';return}
 box.innerHTML=unique.slice(0,25).map(x=>{const title=x.headline||x.title||x.story?.headline||'Actualité football';const desc=x.description||x.summary||x.story?.summary||'';const rawLink=x.links?.web?.href||x.links?.api?.news?.href||x.link||'';let link='#';try{const u=new URL(rawLink);if(u.protocol==='https:'||u.protocol==='http:')link=u.href}catch(_){}const date=x.published||x.lastModified||x.date||'';const mercato=/transfer|transfers|loan|signing|signed|mercato|transfert|prêt|recrut|deal|contract/i.test(title+' '+desc);return '<article class="news-card"><span class="eyebrow">'+(mercato?'MERCATO':'ACTUALITÉ FOOTBALL')+'</span><h3>'+safe(title)+'</h3><p>'+safe(desc)+'</p><small>'+safe(date?appDate(date,{dateStyle:'medium',timeStyle:'short'}):'Date non communiquée')+'</small>'+(link!=='#'?'<p><a href="'+safe(link)+'" target="_blank" rel="noopener">Lire l’article</a></p>':'')+'</article>'}).join('');
}
async function loadLeaders(){
 const box=$('leaders');if(!box)return;const code=$('leaders-league')?.value||'eng.1';
 box.innerHTML='<div class="loading">Chargement des buteurs et passeurs…</div>';
 try{
  const d=await get(API+code+'/leaders?limit=50&region=fr&lang=fr',12000);
  const groups=normaliseLeaderGroups(d);
  const html=groups.map(g=>'<section class="leader-group"><h3>'+safe(g.displayName||g.name||g.abbreviation||'Statistique')+'</h3><ol>'+g.leaders.slice(0,20).map(x=>'<li><b>'+safe(x.athlete?.displayName||x.athlete?.fullName||x.athlete?.shortName||'Joueur non renseigné')+'</b><span class="leader-team">'+crestMarkup(x.team?.displayName||x.athlete?.team?.displayName||'Club',crestUrl(x.team||x.athlete?.team),'leader-crest')+safe(x.team?.displayName||x.athlete?.team?.displayName||'')+'</span><strong>'+safe(x.displayValue??x.value??x.statistics?.[0]?.displayValue??'—')+'</strong></li>').join('')+'</ol></section>').join('');
  if(!html)throw Error('Aucun classement individuel fourni');
  box.innerHTML=html;
 }catch(e){box.innerHTML='<div class="notice">Les statistiques officielles des joueurs ne sont pas accessibles pour cette compétition à cet instant. Aucun buteur ni passeur ne sera inventé.</div>'}
}
function clockSeconds(value){const match=String(value||'').match(/(\\d+):(\\d{2})/);return match?Number(match[1])*60+Number(match[2]):0}
function updateLiveEvent(m,event){const comp=event.competitions?.[0]||{},teams=comp.competitors||[],home=teams.find(x=>x.homeAway==='home')||teams[0],away=teams.find(x=>x.homeAway==='away')||teams[1],st=comp.status?.type||event.status?.type||{},state=st.state;
 if(home?.score!==undefined&&home?.score!==null)m.homeScore=Number(home.score);if(away?.score!==undefined&&away?.score!==null)m.awayScore=Number(away.score);
 m.live=state==='in';m.finished=!!st.completed||state==='post';m.status=m.live?'LIVE':m.finished?'FINISHED':'SCHEDULED';m.periodDetail=st.detail||st.shortDetail||'';m.periodNumber=Number(st.period||0);
 const raw=st.displayClock||comp.status?.displayClock||'';if(raw){m.clockBaseSeconds=clockSeconds(raw);if(m.periodNumber===2&&m.clockBaseSeconds<2700)m.clockBaseSeconds+=2700;if(m.periodNumber===3&&m.clockBaseSeconds<5400)m.clockBaseSeconds+=5400;if(m.periodNumber===4&&m.clockBaseSeconds<6300)m.clockBaseSeconds+=6300;m.clockUpdatedAt=Date.now();}
 m.clockRunning=m.live&&!/half.?time|mi-temps|break|suspended/i.test(m.periodDetail);m.date=event.date||m.date;m.raw=event;
}
async function pollLiveScores(){if(!matches.length)return;const now=Date.now(),groups=new Map();for(const m of matches){const kick=new Date(m.date).getTime();if(!m.code||m.finished||kick>now+8*3600000||kick<now-4*3600000)continue;const day=new Date(m.date).toISOString().slice(0,10).replace(/-/g,'');const key=m.code+'|'+day;if(!groups.has(key))groups.set(key,{code:m.code,day})}
 const requests=[...groups.values()];const results=await Promise.allSettled(requests.map(g=>get(API+g.code+'/scoreboard?dates='+g.day+'&limit=100&region=fr&lang=fr',11000)));
 let changed=false;results.forEach(r=>{if(r.status!=='fulfilled')return;for(const event of r.value.events||[]){const m=matches.find(x=>x.id===String(event.id));if(!m)continue;const before=[m.status,m.homeScore,m.awayScore,m.periodDetail].join('|');updateLiveEvent(m,event);const after=[m.status,m.homeScore,m.awayScore,m.periodDetail].join('|');if(before!==after)changed=true}});
 if(changed){render();renderLive();renderPersonalizedHome();localMatchAlerts()}const active=matches.filter(m=>m.live).length;const el=$('live-indicator');if(el)el.textContent=active?active+' match'+(active>1?'s':'')+' en cours':'Suivi en direct activé';}
async function loadEspnFixtures(){
 const today=new Date();today.setUTCHours(0,0,0,0);
 const pastFrom=new Date(today);pastFrom.setUTCDate(pastFrom.getUTCDate()-35);
 const futureTo=new Date(today);futureTo.setUTCDate(futureTo.getUTCDate()+14);
 const dates=[];for(let d=new Date(pastFrom);d<=futureTo;d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10).replace(/-/g,''));
 const tasks=[];for(const [code,label] of leagues)for(const day of dates)tasks.push({code,label,day});
 const found=[];let cursor=0;
 const workers=Array.from({length:10},async()=>{while(true){const i=cursor++;if(i>=tasks.length)break;const {code,label,day}=tasks[i];try{const data=await get(API+code+'/scoreboard?dates='+day+'&limit=100&region=fr&lang=fr',15000);for(const event of data.events||[]){const item=mapEvent(event,code,label);if(item.date&&item.home!=='Équipe inconnue'&&item.away!=='Équipe inconnue')found.push(item)}}catch(error){console.warn('Calendrier de secours indisponible',code,day,error?.message||error)}}});
 await Promise.all(workers);
 return [...new Map(found.map(m=>[String(m.id),m])).values()].sort((x,y)=>new Date(x.date)-new Date(y.date));
}
async function refresh(){if(busy)return;busy=true;$('home-matches').innerHTML='<div class="loading">Récupération du calendrier et des résultats…</div>';try{
 let loaded=false;
 try{const d=await get('./matches.json',9000);const source=(d.matches||[]).map(m=>{const c=m.competition?.code||'';const code=c.startsWith('ESPN-')?c.slice(5):(m.source==='ESPN'?'eng.1':'');const st=m.status||'SCHEDULED';const live=st==='IN_PLAY'||st==='LIVE';const finished=st==='FINISHED';const national=isNationalCompetition(code);return{id:String(m.id).replace(/^espn-/,''),code,league:m.competition?.name||'Compétition',competition:m.competition?.name||'',home:m.homeTeam?.name||'Équipe domicile',away:m.awayTeam?.name||'Équipe extérieure',homeLogo:national?(teamFlagUrl(m.homeTeam)||m.homeTeam?.logo||m.homeTeam?.crest||''):(m.homeTeam?.logo||m.homeTeam?.crest||''),awayLogo:national?(teamFlagUrl(m.awayTeam)||m.awayTeam?.logo||m.awayTeam?.crest||''):(m.awayTeam?.logo||m.awayTeam?.crest||''),homeNational:national,awayNational:national,homeId:m.homeTeam?.id||null,awayId:m.awayTeam?.id||null,homeScore:m.score?.fullTime?.home??null,awayScore:m.score?.fullTime?.away??null,date:m.utcDate,status:live?'LIVE':finished?'FINISHED':'SCHEDULED',live,finished,periodDetail:'',periodNumber:0,clockBaseSeconds:null,clockUpdatedAt:Date.now(),clockRunning:false,venue:'',raw:m}}).filter(m=>m.date&&m.home&&m.away);if(source.length){matches=source;loaded=true}}catch(error){/* Le flux pré-généré n'est pas toujours publié. */ }
 if(!loaded){matches=await loadEspnFixtures();if(!matches.length)throw Error('Aucun calendrier retourné par les sources');}
 render();renderLive();renderPicks();renderVIP();renderPersonalizedHome();localMatchAlerts();$('updated').textContent='Données actualisées · '+matches.length+' rencontres · '+appDate(new Date(),{dateStyle:'medium',timeStyle:'short'});
 }catch(e){matches=[];render();renderLive();renderPicks();$('updated').textContent='Sources temporairement indisponibles';$('home-matches').innerHTML='<div class="notice">Les calendriers ne répondent pas actuellement. Vérifie ta connexion puis actualise. Aucun match ni score fictif ne sera affiché.</div>'}finally{busy=false}}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+b.dataset.page));if(b.dataset.page==='competitions')loadStandings();if(b.dataset.page==='teams')loadTeams();if(b.dataset.page==='pronos')renderPicks();if(b.dataset.page==='news')loadNews();if(b.dataset.page==='leaders')loadLeaders();if(b.dataset.page==='community')loadCommunity();if(b.dataset.page==='settings')loadSettings();if(b.dataset.page==='vip'){renderVIP();}});
$('search').oninput=render;$('refresh-live')?.addEventListener('click',refresh);$('vip-open-pronos')?.addEventListener('click',()=>document.querySelector('[data-page="pronos"]')?.click());$('save-notifications')?.addEventListener('click',saveNotificationPrefs);$('enable-background-push')?.addEventListener('click',enableBackgroundPush);$('settings-save')?.addEventListener('click',saveSettings);$('settings-edit-favorites')?.addEventListener('click',()=>$('account-open').click());$('settings-edit-alerts')?.addEventListener('click',()=>$('account-open').click());$('settings-reset-onboarding')?.addEventListener('click',()=>{localStorage.removeItem(PREF_KEY);showOnboarding(true)});$('date-filter').onchange=render;$('refresh').onclick=refresh;$('close-modal').onclick=()=>$('match-modal').hidden=true;$('match-modal').onclick=e=>{if(e.target===$('match-modal'))$('match-modal').hidden=true};
const teamCatalogLeagues=leagues.filter(([c])=>!['uefa.champions','uefa.europa','uefa.europa.conf','afc.champions','fifa.world','caf.nations','uefa.wchampions'].includes(c));
$('teams-competition').innerHTML=teamCatalogLeagues.map(([c,n])=>'<option value="'+c+'">'+safe(n)+'</option>').join('')+'<option value="fifa.world">Sélections nationales · Coupe du monde</option><option value="caf.nations">Sélections nationales · Coupe d’Afrique des nations</option><option value="uefa.euro">Sélections nationales · Euro</option><option value="uefa.nations">Sélections nationales · Ligue des nations</option><option value="conmebol.copa">Sélections nationales · Copa América</option><option value="concacaf.gold">Sélections nationales · Gold Cup</option><option value="afc.asian">Sélections nationales · Coupe d’Asie</option>';$('load-teams').onclick=loadTeams;$('teams-competition').onchange=loadTeams;$('competition-list').innerHTML=standingsLeagues.map(([c,n])=>'<div class="competition-item"><button class="competition" data-code="'+c+'">'+safe(n)+'</button><button class="favorite-competition" type="button" data-fav-comp="'+c+'" data-name="'+safe(n)+'">☆</button></div>').join('');$('standings-league').innerHTML=standingsLeagues.map(([c,n])=>'<option value="'+c+'">'+safe(n)+'</option>').join('');if($('leaders-league'))$('leaders-league').innerHTML=leagues.filter(([code])=>!['caf.nations','uefa.wchampions'].includes(code)).map(([code,name])=>'<option value="'+code+'">'+safe(name)+'</option>').join('');$('competition-list').querySelectorAll('.competition').forEach(b=>b.onclick=()=>{$('standings-league').value=b.dataset.code;loadStandings()});$('competition-list').querySelectorAll('[data-fav-comp]').forEach(b=>b.onclick=()=>toggleFavorite('favorite_competitions','competition_id',b.dataset.favComp,b.dataset.name));$('load-standings').onclick=loadStandings;if($('leaders-league'))$('leaders-league').onchange=loadLeaders;
let promptEvent=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;$('install').hidden=false});$('install').onclick=async()=>{if(promptEvent){promptEvent.prompt();await promptEvent.userChoice;promptEvent=null}else alert('Menu Chrome ⋮ puis Installer l’application.');};
initOnboarding();$('account-open')?.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-account'));window.scrollTo({top:0,behavior:'smooth'});});if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));refresh().then(()=>pollLiveScores());scheduleRefresh();setInterval(pollLiveScores,60000);setInterval(pollOfficialLineups,60000);setTimeout(pollOfficialLineups,12000);setInterval(()=>{if(matches.some(m=>m.live)){render();renderLive()}},1000);setInterval(localMatchAlerts,60000);setInterval(pollLiveEventAlerts,60000);setTimeout(pollLiveEventAlerts,15000);function initAccountSync(){if(!window.GoldSupabase)return;window.GoldSupabase.auth.onAuthStateChange(()=>setTimeout(loadAccountFeatures,0));window.GoldSupabase.auth.getSession().then(({data})=>{if(data.session)loadAccountFeatures()})}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAccountSync,{once:true});else initAccountSync();
})();