(()=>{'use strict';
const URL='https://tmrizkeigrcqzyzashet.supabase.co';
const KEY='sb_publishable_OELT8InFb3gQIfPE1e-6vw_UI-xBs99';
const $=id=>document.getElementById(id);
let client=null,signup=true;
const say=msg=>{const el=$('account-status');if(el)el.textContent=msg};
function init(){
 if(!window.supabase?.createClient){say('Le service de compte ne s’est pas chargé. Vérifie ta connexion puis actualise.');return}
 client=window.supabase.createClient(URL,KEY);window.GoldSupabase=client;
 const form=$('auth-form');if(!form)return;
 $('account-open').onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-account'));window.scrollTo({top:0,behavior:'smooth'});};
 $('auth-toggle').onclick=()=>{signup=!signup;$('auth-submit').textContent=signup?'Créer mon compte':'Se connecter';$('auth-toggle').textContent=signup?'J’ai déjà un compte':'Créer un compte';$('auth-display').hidden=!signup;};
 form.onsubmit=async e=>{e.preventDefault();const email=$('auth-email').value.trim(),password=$('auth-password').value,display=$('auth-display').value.trim();$('auth-submit').disabled=true;
 try{if(signup){const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname,data:{display_name:display||email.split('@')[0],preferred_language:document.documentElement.lang||'fr'}}});if(error)throw error;say(data.session?'Compte créé et connecté.':'Compte créé. Vérifie ta boîte e-mail pour confirmer ton adresse avant de te connecter.');if(data.session)await loadProfile();}
 else{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;say('Connexion réussie.');await loadProfile();}}
 catch(err){say(err.message||'Impossible de terminer cette opération. Réessaie.')}finally{$('auth-submit').disabled=false}};
 $('auth-signout').onclick=async()=>{await client.auth.signOut();$('account-panel').hidden=true;$('auth-form').hidden=false;say('Tu es déconnecté.');};
 $('profile-save').onclick=async()=>{const u=(await client.auth.getUser()).data.user;if(!u)return;const {error}=await client.from('profiles').update({display_name:$('profile-name').value.trim(),updated_at:new Date().toISOString()}).eq('id',u.id);say(error?error.message:'Profil enregistré.');};
 client.auth.onAuthStateChange((event,session)=>{if(session){setTimeout(()=>loadProfile().catch(()=>say('Connecté, mais le profil ne peut pas être chargé pour le moment.')),0)}else if(event==='SIGNED_OUT'){$('account-panel').hidden=true;$('auth-form').hidden=false}});
 client.auth.getSession().then(({data})=>{if(data.session)loadProfile()});
 const lang=$('language-select');if(lang){lang.value=window.GoldI18n?.getLanguage?.()||'fr';lang.onchange=()=>window.GoldI18n?.setLanguage?.(lang.value);}
}
async function loadProfile(){if(!client)return;const {data:{user}}=await client.auth.getUser();if(!user)return;$('auth-form').hidden=true;$('account-panel').hidden=false;const {data,error}=await client.from('profiles').select('display_name,preferred_language').eq('id',user.id).maybeSingle();$('profile-name').value=data?.display_name||user.email.split('@')[0];say(error?'Connecté, mais le profil est momentanément indisponible.':'Connecté avec '+user.email+'. Ton espace personnel est prêt.');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();