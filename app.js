(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { matches: [], filter: 'all', generatedAt: null, sources: {} };
  const dateFmt = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const timeFmt = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit'
  });

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function setStatus(message) {
    setText('match-status', message);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date non disponible';
    return dateFmt.format(date);
  }

  function validMatch(match) {
    return match && typeof match === 'object' &&
      typeof match.utcDate === 'string' &&
      !Number.isNaN(new Date(match.utcDate).getTime()) &&
      match.homeTeam && match.awayTeam;
  }

  function createMatchCard(match) {
    const card = document.createElement('article');
    card.className = 'match-card';

    const top = document.createElement('div');
    top.className = 'match-top';
    const competition = document.createElement('span');
    competition.className = 'competition';
    competition.textContent = match.competition?.name || 'Compétition non précisée';
    const status = document.createElement('span');
    const labels = {
      FINISHED: 'TERMINÉ', IN_PLAY: 'EN COURS', PAUSED: 'PAUSE',
      POSTPONED: 'REPORTÉ', CANCELLED: 'ANNULÉ', SCHEDULED: 'À VENIR'
    };
    status.textContent = labels[match.status] || 'PROGRAMMÉ';
    top.append(competition, status);

    const teams = document.createElement('div');
    teams.className = 'match-teams';
    const home = document.createElement('span');
    home.textContent = match.homeTeam?.name || 'Équipe domicile';
    const score = document.createElement('span');
    score.className = 'versus';
    const homeScore = match.score?.fullTime?.home ?? match.score?.halfTime?.home;
    const awayScore = match.score?.fullTime?.away ?? match.score?.halfTime?.away;
    const hasScore = homeScore !== null && homeScore !== undefined &&
      awayScore !== null && awayScore !== undefined;
    score.textContent = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(match.status) && hasScore
      ? String(homeScore) + ' - ' + String(awayScore) : 'VS';
    const away = document.createElement('span');
    away.className = 'team-away';
    away.textContent = match.awayTeam?.name || 'Équipe extérieure';
    teams.append(home, score, away);

    const bottom = document.createElement('div');
    bottom.className = 'match-bottom';
    const date = new Date(match.utcDate);
    const dateLabel = document.createElement('span');
    dateLabel.textContent = formatDate(match.utcDate) + ' · ' +
      (Number.isNaN(date.getTime()) ? '--:--' : timeFmt.format(date));
    const matchday = document.createElement('span');
    matchday.textContent = match.matchday ? 'Journée ' + match.matchday :
      (match.source || 'Calendrier');
    bottom.append(dateLabel, matchday);
    card.append(top, teams, bottom);
    return card;
  }

  function renderMatches() {
    const list = $('match-list');
    if (!list) return;
    list.replaceChildren();

    const now = new Date();
    const filtered = state.matches.filter(match => {
      const date = new Date(match.utcDate);
      if (state.filter === 'finished') return match.status === 'FINISHED';
      if (state.filter === 'today') {
        return date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate();
      }
      return !['FINISHED', 'CANCELLED'].includes(match.status);
    }).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    setText('match-count', String(filtered.length));
    setText('match-period', state.filter === 'today' ? 'Rencontres du jour' :
      state.filter === 'finished' ? 'Résultats terminés' : 'Rencontres à venir');

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'status-panel';
      empty.textContent = state.filter === 'finished'
        ? 'Aucun résultat terminé dans la période fournie par la source.'
        : state.matches.length
          ? 'Aucun match dans ce filtre pour la période chargée.'
          : 'Aucune rencontre disponible pour le moment.';
      list.append(empty);
      return;
    }
    filtered.forEach(match => list.append(createMatchCard(match)));
  }

  function updateSourceDetails() {
    const count = state.matches.length;
    const footballData = Number(state.sources.footballData || 0);
    const espn = Number(state.sources.espn || 0);
    setText('source-status', count ? 'DONNÉES CHARGÉES' : 'AUCUN MATCH');
    setText('source-detail', footballData + ' football-data.org · ' + espn + ' ESPN');
    const generated = state.generatedAt ? new Date(state.generatedAt) : null;
    const generatedLabel = generated && !Number.isNaN(generated.getTime())
      ? 'Dernière collecte : ' + dateFmt.format(generated) + ' à ' + timeFmt.format(generated) + '. '
      : '';
    setText('report-title', count + ' rencontre(s) disponibles');
    setText('report-copy', generatedLabel +
      'Calendrier uniquement : les statistiques détaillées et les cotes bookmakers ne sont pas encore intégrées.');
    setText('settings-message',
      'Données préparées par GitHub Actions. Sur le site, elles sont renouvelées lors des collectes planifiées ; dans l’APK, elles correspondent à la date de compilation.');
  }

  async function loadMatches() {
    const button = $('refresh-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Chargement…';
    }
    setStatus('Chargement du calendrier…');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await fetch('./matches.json?v=' + Date.now(), {
          cache: 'no-store', signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        throw new Error('Fichier des rencontres inaccessible (HTTP ' + response.status + ').');
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.matches)) {
        throw new Error('Format du calendrier invalide : la liste des matchs est absente.');
      }
      state.matches = data.matches.filter(validMatch);
      state.generatedAt = data.generatedAt || null;
      state.sources = data.sources || {};
      updateSourceDetails();
      setStatus(state.matches.length + ' rencontre(s) chargée(s). Les horaires sont affichés selon le fuseau de ton téléphone.');
      renderMatches();
    } catch (error) {
      state.matches = [];
      setText('match-count', '0');
      setText('source-status', 'INDISPONIBLE');
      setText('source-detail', 'Données à vérifier');
      setStatus(error.name === 'AbortError'
        ? 'La source met trop de temps à répondre. Réessaie dans quelques instants.'
        : error.message || 'Une erreur inconnue empêche le chargement du calendrier.');
      const list = $('match-list');
      if (list) list.replaceChildren();
      setText('report-title', 'Données indisponibles');
      setText('report-copy', 'Aucune analyse ne sera affichée sans calendrier valide.');
      setText('settings-message', 'Vérifie le prochain déploiement GitHub Pages puis réessaie.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Actualiser ↻';
      }
    }
  }

  window.addEventListener('error', event => {
    setText('source-status', 'ERREUR JAVASCRIPT');
    setStatus('Erreur JavaScript : ' + (event.message || 'erreur inconnue') + '.');
  });
  window.addEventListener('unhandledrejection', event => {
    setText('source-status', 'ERREUR APPLICATION');
    setStatus('Une opération a échoué : ' + String(event.reason?.message || event.reason || 'erreur inconnue'));
  });

  const refresh = $('refresh-btn');
  if (refresh) refresh.addEventListener('click', loadMatches);
  document.querySelectorAll('.filter').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(item =>
        item.classList.toggle('active', item === button));
      state.filter = button.dataset.filter || 'all';
      renderMatches();
    });
  });
  document.querySelectorAll('.bottom-nav a').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.bottom-nav a').forEach(item =>
        item.classList.toggle('active', item === link));
    });
  });

  setText('today', dateFmt.format(new Date()));
  loadMatches();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => registrations.forEach(registration => registration.unregister()))
      .catch(() => {});
  }
})();
