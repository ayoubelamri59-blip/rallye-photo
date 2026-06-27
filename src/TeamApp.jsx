import React, { useState, useEffect, useRef } from 'react';
import { sbFetch, sbUpload, compressImage, TEAM_COLORS, shuffleArray } from './shared.js';
import { Leaderboard, CenteredLoader } from './AdminApp.jsx';

function usePolling(fetchFn, intervalMs, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef(fetchFn);
  ref.current = fetchFn;
  useEffect(() => {
    let active = true, timer;
    async function tick() {
      try {
        const result = await ref.current();
        if (active) { setData(result); setLoading(false); }
      } catch (e) { console.error(e); }
      timer = setTimeout(tick, intervalMs);
    }
    tick();
    return () => { active = false; clearTimeout(timer); };
  }, deps);
  return [data, loading];
}

const Icon = {
  camera: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></svg>,
  check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  star: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>,
  clock: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  arrowRight: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
};

const SESSION_KEY = 'rallye_photo_session';

function saveSession(team, game) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ teamId: team.id, gameId: game.id }));
  } catch (e) { /* localStorage indisponible, on continue sans persistance */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export default function TeamApp({ onExit }) {
  const [team, setTeam] = useState(null);
  const [game, setGame] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const saved = readSession();
      if (!saved) { setCheckingSession(false); return; }
      try {
        const [teams, games] = await Promise.all([
          sbFetch(`teams?id=eq.${saved.teamId}`),
          sbFetch(`games?id=eq.${saved.gameId}`),
        ]);
        if (teams && teams.length && games && games.length) {
          setTeam(teams[0]);
          setGame(games[0]);
        } else {
          clearSession();
        }
      } catch (e) {
        clearSession();
      }
      setCheckingSession(false);
    }
    restoreSession();
  }, []);

  function handleJoined(t, g) {
    saveSession(t, g);
    setTeam(t);
    setGame(g);
  }

  function handleExit() {
    clearSession();
    onExit();
  }

  if (checkingSession) return <CenteredLoader label="Reconnexion..." />;
  if (!team) return <JoinScreen onJoined={handleJoined} onExit={onExit} />;
  return <TeamGame team={team} game={game} onRefreshGame={setGame} onExit={handleExit} />;
}

function JoinScreen({ onJoined, onExit }) {
  const [step, setStep] = useState('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function checkCode() {
    setError('');
    setBusy(true);
    try {
      const cleaned = code.trim().toUpperCase();
      const games = await sbFetch(`games?party_code=eq.${cleaned}`);
      if (!games || games.length === 0) {
        setError("Code introuvable. Vérifie avec l'animateur.");
        setBusy(false);
        return;
      }
      setGame(games[0]);
      setStep('name');
    } catch (e) {
      setError('Connexion impossible. Réessaie.');
    }
    setBusy(false);
  }

  async function createTeam() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const existing = await sbFetch(`teams?game_id=eq.${game.id}`);
      const color = TEAM_COLORS[(existing?.length || 0) % TEAM_COLORS.length];
      const challenges = await sbFetch(`challenges?game_id=eq.${game.id}`);
      const queue = shuffleArray((challenges || []).map((c) => c.id));
      const created = await sbFetch('teams', {
        method: 'POST',
        body: JSON.stringify({ game_id: game.id, name: name.trim(), color, challenge_queue: queue }),
      });
      onJoined(created[0], game);
    } catch (e) {
      setError("Impossible de créer l'équipe. Réessaie.");
    }
    setBusy(false);
  }

  return (
    <div style={S.page}>
      <div style={S.joinWrap}>
        <button style={S.exitLink} onClick={onExit}>← Accueil</button>
        <div style={S.bigEmoji}>📸</div>
        <h1 style={S.h1}>Rallye photo</h1>

        {step === 'code' && (
          <>
            <p style={S.lead}>Entre le code donné par l'animateur</p>
            <input
              style={S.codeInput}
              placeholder="EX: JUNGLE42"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkCode()}
              autoCapitalize="characters"
            />
            {error && <p style={S.errorText}>{error}</p>}
            <button style={S.primaryBtn} onClick={checkCode} disabled={busy}>
              {busy ? 'Vérification...' : 'Continuer'} <Icon.arrowRight style={S.iconSm} />
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <p style={S.lead}>Quel est le nom de ton équipe ?</p>
            <input
              style={S.codeInput}
              placeholder="Les Aigles"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTeam()}
            />
            {error && <p style={S.errorText}>{error}</p>}
            <button style={S.primaryBtn} onClick={createTeam} disabled={busy}>
              {busy ? 'Création...' : "C'est parti"} <Icon.arrowRight style={S.iconSm} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TeamGame({ team, game, onRefreshGame, onExit }) {
  const [gameData, gameLoading] = usePolling(async () => {
    const g = await sbFetch(`games?id=eq.${game.id}`);
    return g && g.length ? g[0] : null;
  }, 4000, [game.id]);

  useEffect(() => { if (gameData && gameData.phase !== game.phase) onRefreshGame(gameData); }, [gameData]);

  // La partie n'existe plus (supprimée par l'animateur) : on informe et on nettoie la session
  if (!gameLoading && gameData === null) {
    return (
      <div style={S.page}>
        <div style={S.waitWrap}>
          <div style={S.bigEmoji}>🏁</div>
          <p style={S.lead}>Cette partie est terminée.</p>
          <p style={S.subLead}>Merci d'avoir joué !</p>
          <button style={{ ...S.primaryBtn, marginTop: 20 }} onClick={onExit}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  const phase = gameData?.phase || game.phase;

  return (
    <div style={S.page}>
      <header style={S.gameHeader}>
        <div style={{ ...S.teamBadge, background: team.color }}>{team.name}</div>
      </header>

      {phase === 'setup' && (
        <div style={S.waitWrap}>
          <Icon.clock style={S.bigIcon} />
          <p style={S.lead}>La partie n'a pas encore commencé.</p>
          <p style={S.subLead}>Patiente, l'animateur va bientôt lancer le rallye !</p>
        </div>
      )}
      {phase === 'playing' && <TeamChallenges team={team} game={game} />}
      {phase === 'voting' && <TeamVoting team={team} game={game} />}
      {phase === 'finished' && <Leaderboard gameId={game.id} />}
    </div>
  );
}

const ENCOURAGEMENTS = [
  "Trop forts !", "Encore un effort !", "Vous gérez !", "Continuez comme ça !",
  "Magnifique équipe !", "Allez allez allez !", "Vous êtes sur la bonne voie !", "Quelle équipe !",
];

function TeamChallenges({ team, game }) {
  const [data, loading] = usePolling(async () => {
    const [teamFresh, challenges, subs, teams] = await Promise.all([
      sbFetch(`teams?id=eq.${team.id}`),
      sbFetch(`challenges?game_id=eq.${game.id}`),
      sbFetch(`submissions?game_id=eq.${game.id}&team_id=eq.${team.id}`),
      sbFetch(`teams?game_id=eq.${game.id}&select=id`),
    ]);
    return { team: teamFresh?.[0] || team, challenges: challenges || [], subs: subs || [], totalTeams: teams ? teams.length : 0 };
  }, 2500, [game.id, team.id]);

  const [celebratingChallengeId, setCelebratingChallengeId] = useState(null);
  const previousApprovedIds = useRef(new Set());
  const [encouragement, setEncouragement] = useState(ENCOURAGEMENTS[0]);
  const [raceCount, setRaceCount] = useState(null);

  useEffect(() => {
    if (!data) return;
    const approvedNow = new Set(data.subs.filter((s) => s.status === 'approved').map((s) => s.challenge_id));
    const newlyApproved = [...approvedNow].filter((id) => !previousApprovedIds.current.has(id));
    if (newlyApproved.length > 0 && previousApprovedIds.current.size > 0) {
      setCelebratingChallengeId(newlyApproved[0]);
      setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
      const t = setTimeout(() => setCelebratingChallengeId(null), 1800);
      return () => clearTimeout(t);
    }
    previousApprovedIds.current = approvedNow;
  }, [data]);

  // Calcul sûr du défi courant même avant que `data` soit chargé, pour respecter les règles des hooks
  const safeQueue = data?.team?.challenge_queue || [];
  const safeSubByChallenge = data ? Object.fromEntries(data.subs.map((s) => [s.challenge_id, s])) : {};
  const liveCurrentChallengeId = safeQueue.find((id) => {
    const sub = safeSubByChallenge[id];
    return !sub || sub.status !== 'approved';
  });

  useEffect(() => {
    if (!liveCurrentChallengeId || !data) { setRaceCount(null); return; }
    let active = true;
    async function fetchRaceCount() {
      try {
        const approvedForChallenge = await sbFetch(`submissions?challenge_id=eq.${liveCurrentChallengeId}&status=eq.approved&select=team_id`);
        if (active) setRaceCount(approvedForChallenge ? approvedForChallenge.length : 0);
      } catch (e) { /* pas critique, on laisse raceCount à son ancienne valeur */ }
    }
    fetchRaceCount();
    const interval = setInterval(fetchRaceCount, 4000);
    return () => { active = false; clearInterval(interval); };
  }, [liveCurrentChallengeId, game.id]);

  if (loading || !data) return <CenteredLoader label="Chargement des défis..." />;
  const { team: freshTeam, challenges, subs, totalTeams } = data;
  const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));
  const subByChallenge = Object.fromEntries(subs.map((s) => [s.challenge_id, s]));
  const queue = freshTeam.challenge_queue || [];

  // Le défi courant = premier de la file qui n'est pas encore approuvé,
  // ou qu'on vient de soumettre localement (pour éviter un flash de retour en arrière pendant le polling)
  const currentChallengeId = queue.find((id) => {
    const sub = subByChallenge[id];
    return !sub || sub.status !== 'approved';
  });

  const approvedCount = queue.length - queue.filter((id) => {
    const sub = subByChallenge[id];
    return !sub || sub.status !== 'approved';
  }).length;

  if (celebratingChallengeId) {
    return (
      <div style={S.contentWrap}>
        <div style={S.celebrateWrap}>
          <div style={S.celebrateEmoji}>🎉</div>
          <h2 style={{ ...S.h2, textAlign: 'center' }}>Défi réussi !</h2>
          <p style={{ ...S.lead, textAlign: 'center' }}>{encouragement}</p>
        </div>
      </div>
    );
  }

  if (!currentChallengeId) {
    return (
      <div style={S.contentWrap}>
        <div style={S.allDoneWrap}>
          <div style={S.allDoneEmoji}>🏕️</div>
          <h2 style={{ ...S.h2, textAlign: 'center' }}>Bravo, tous les défis sont terminés !</h2>
          <p style={{ ...S.lead, textAlign: 'center' }}>Rejoignez le camp pour la partie finale !</p>
        </div>
      </div>
    );
  }

  const currentChallenge = challengeById[currentChallengeId];
  const currentSub = subByChallenge[currentChallengeId];
  if (!currentChallenge) return <CenteredLoader label="Chargement du prochain défi..." />;

  return (
    <div style={S.contentWrap}>
      <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${(approvedCount / Math.max(queue.length, 1)) * 100}%` }} /></div>
      <p style={S.progressLabel}>{approvedCount} / {queue.length} défis réussis</p>
      {raceCount != null && totalTeams > 0 && (
        <p style={S.raceHint}>🏃 {raceCount} / {totalTeams} équipe{totalTeams > 1 ? 's' : ''} ont déjà réussi ce défi</p>
      )}

      <ChallengeCapture
        key={currentChallengeId}
        team={team}
        game={game}
        challenge={currentChallenge}
        existing={currentSub}
      />
    </div>
  );
}

function ChallengeCapture({ team, game, challenge, existing }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(existing?.photo_url || null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const blob = await compressImage(file);
      const filename = `${game.id}/${challenge.id}/${team.id}-${Date.now()}.jpg`;
      const url = await sbUpload('rallye-photos', filename, blob);
      setPreview(url);
      if (existing) {
        await sbFetch(`submissions?id=eq.${existing.id}`, { method: 'PATCH', body: JSON.stringify({ photo_url: url, status: 'pending', submitted_at: new Date().toISOString() }) });
      } else {
        await sbFetch('submissions', { method: 'POST', body: JSON.stringify({ game_id: game.id, challenge_id: challenge.id, team_id: team.id, photo_url: url, status: 'pending' }) });
      }
    } catch (err) {
      console.error(err);
      setUploadError("L'envoi a échoué. Vérifie ta connexion et réessaie.");
    }
    setUploading(false);
  }

  return (
    <div>
      <div style={S.captureHeader}>
        <span style={S.captureEmoji}>{challenge.emoji || '✨'}</span>
        <h2 style={S.h2}>{challenge.title}</h2>
      </div>
      {challenge.description && <p style={S.bodyText}>{challenge.description}</p>}

      {existing?.status === 'rejected' && <p style={S.errorText}>Cette photo a été refusée. Reprends-en une nouvelle !</p>}
      {existing?.status === 'pending' && <p style={S.pendingText}>Photo envoyée ! Place au défi suivant pendant que l'animateur valide celle-ci.</p>}
      {uploadError && <p style={S.errorText}>{uploadError}</p>}

      {preview && <img src={preview} alt="" style={S.previewImg} />}

      {existing?.status !== 'pending' && (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
          <button style={S.primaryBtn} onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? 'Envoi en cours...' : preview ? 'Reprendre une photo' : 'Prendre la photo'} <Icon.camera style={S.iconSm} />
          </button>
        </>
      )}
    </div>
  );
}

function TeamVoting({ team, game }) {
  const [data, loading] = usePolling(async () => {
    const [gameFresh, challenges, subs, votes, teams] = await Promise.all([
      sbFetch(`games?id=eq.${game.id}`),
      sbFetch(`challenges?game_id=eq.${game.id}`),
      sbFetch(`submissions?game_id=eq.${game.id}&status=eq.approved`),
      sbFetch(`votes?game_id=eq.${game.id}&voting_team_id=eq.${team.id}`),
      sbFetch(`teams?game_id=eq.${game.id}`),
    ]);
    return { game: gameFresh?.[0] || game, challenges: challenges || [], subs: subs || [], votes: votes || [], teams: teams || [] };
  }, 1500, [game.id, team.id]);

  async function castVote(challengeId, submissionId) {
    await sbFetch('votes', { method: 'POST', body: JSON.stringify({ game_id: game.id, challenge_id: challengeId, voting_team_id: team.id, voted_for_submission_id: submissionId }) });
  }

  if (loading || !data) return <CenteredLoader label="Chargement du vote..." />;
  const { game: freshGame, challenges, subs, votes, teams } = data;
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));

  if (!freshGame.vote_started_at || !freshGame.vote_challenge_id) {
    return (
      <div style={S.contentWrap}>
        <div style={S.waitWrap}>
          <div style={S.bigEmoji}>⭐</div>
          <p style={S.lead}>Le vote va commencer !</p>
          <p style={S.subLead}>Attends que l'animateur lance le premier défi à voter.</p>
        </div>
      </div>
    );
  }

  const currentChallenge = challengeById[freshGame.vote_challenge_id];
  if (!currentChallenge) return <CenteredLoader label="Chargement..." />;

  const candidateSubs = subs.filter((s) => s.challenge_id === freshGame.vote_challenge_id && s.team_id !== team.id);
  const myVote = votes.find((v) => v.challenge_id === freshGame.vote_challenge_id);
  const alreadyVoted = !!myVote;

  if (freshGame.vote_revealed) {
    const votesForChallenge = votes.filter((v) => v.challenge_id === freshGame.vote_challenge_id);
    return (
      <div style={S.contentWrap}>
        <TeamRevealView
          candidateSubs={subs.filter((s) => s.challenge_id === freshGame.vote_challenge_id)}
          allVotes={votes}
          teamById={teamById}
        />
      </div>
    );
  }

  const elapsed = (Date.now() - new Date(freshGame.vote_started_at).getTime()) / 1000;
  const remaining = Math.max(0, Math.ceil(freshGame.vote_duration_seconds - elapsed));

  // Si l'équipe elle-même est l'auteur de ce défi (aucune photo d'autre équipe), rien à voter
  if (candidateSubs.length === 0) {
    return (
      <div style={S.contentWrap}>
        <div style={S.voteHeaderRow}>
          <span style={S.voteStepIndicator}>Vote en cours</span>
          <span style={S.voteTimer}>{remaining}s</span>
        </div>
        <h2 style={{ ...S.h2, textAlign: 'center' }}>{currentChallenge.emoji} {currentChallenge.title}</h2>
        <p style={{ ...S.lead, textAlign: 'center', marginTop: 20 }}>C'est votre défi ! Vous ne votez pas sur celui-ci, attendez le résultat.</p>
      </div>
    );
  }

  return (
    <div style={S.contentWrap}>
      <div style={S.voteHeaderRow}>
        <span style={S.voteStepIndicator}>Vote en cours</span>
        <span style={S.voteTimer}>{remaining}s</span>
      </div>
      <h2 style={S.voteChallengeTitle}>{currentChallenge.emoji} {currentChallenge.title}</h2>
      <p style={S.voteHint}>{alreadyVoted ? 'Vote envoyé, en attente des autres équipes' : 'Glisse pour voir les photos, touche celle que tu préfères'}</p>

      <PhotoCarousel
        subs={candidateSubs}
        teamById={teamById}
        myVoteSubmissionId={myVote?.voted_for_submission_id}
        disabled={alreadyVoted}
        onVote={(submissionId) => castVote(freshGame.vote_challenge_id, submissionId)}
      />
    </div>
  );
}

function TeamRevealView({ candidateSubs, allVotes, teamById }) {
  const voteCountBySub = {};
  allVotes.forEach((v) => { voteCountBySub[v.voted_for_submission_id] = (voteCountBySub[v.voted_for_submission_id] || 0) + 1; });
  if (candidateSubs.length === 0) return null;
  const ranked = [...candidateSubs].sort((a, b) => (voteCountBySub[b.id] || 0) - (voteCountBySub[a.id] || 0));
  const winner = ranked[0];
  const winnerVotes = voteCountBySub[winner.id] || 0;

  return (
    <div style={S.revealWrap}>
      <div style={S.revealBadge}>🏆 Photo gagnante</div>
      <img src={winner.photo_url} alt="" style={S.revealImg} />
      <div style={S.revealTeamName}>{teamById[winner.team_id]?.name}</div>
      <div style={S.revealVoteCount}>{winnerVotes} vote{winnerVotes > 1 ? 's' : ''}</div>
      <p style={S.revealAutoText}>En attente du prochain défi...</p>
    </div>
  );
}

function PhotoCarousel({ subs, teamById, myVoteSubmissionId, disabled, onVote }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  const safeIndex = Math.min(index, subs.length - 1);

  useEffect(() => { setIndex(0); }, [subs.length > 0 ? subs[0].challenge_id : null]);

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 50) setIndex((i) => Math.max(0, i - 1));
    else if (delta < -50) setIndex((i) => Math.min(subs.length - 1, i + 1));
    touchStartX.current = null;
  }

  if (subs.length === 0) return null;
  const current = subs[safeIndex];
  const isMyVote = myVoteSubmissionId === current.id;

  return (
    <div style={S.carouselWrap}>
      <div
        style={S.carouselPhotoBox}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img src={current.photo_url} alt="" style={S.carouselImg} />
        {isMyVote && (
          <div style={S.carouselSelectedBadge}>
            <Icon.star style={S.carouselStarIcon} /> Ton vote
          </div>
        )}
        {safeIndex > 0 && (
          <button style={{ ...S.carouselArrow, ...S.carouselArrowLeft }} onClick={() => setIndex((i) => i - 1)}>‹</button>
        )}
        {safeIndex < subs.length - 1 && (
          <button style={{ ...S.carouselArrow, ...S.carouselArrowRight }} onClick={() => setIndex((i) => i + 1)}>›</button>
        )}
      </div>

      <div style={S.carouselFooter}>
        <span style={S.carouselTeamName}>{teamById[current.team_id]?.name}</span>
        <span style={S.carouselCounter}>{safeIndex + 1} / {subs.length}</span>
      </div>

      <button
        style={{ ...S.voteThisBtn, ...(isMyVote ? S.voteThisBtnSelected : {}), ...(disabled ? S.btnDisabled : {}) }}
        onClick={() => !disabled && onVote(current.id)}
        disabled={disabled}
      >
        {isMyVote ? <>Photo choisie <Icon.star style={S.iconSm} /></> : disabled ? 'Vote déjà envoyé' : 'Choisir cette photo'}
      </button>
    </div>
  );
}

function EmptyHint({ text }) { return <div style={S.emptyHint}>{text}</div>; }

const S = {
  page: { minHeight: '100vh', background: '#FFF8EF', fontFamily: "'Nunito', 'Quicksand', -apple-system, sans-serif", color: '#2B2440', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 56px' },
  exitLink: { background: 'none', border: 'none', color: '#9C6ADE', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit', alignSelf: 'flex-start' },

  joinWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '4vh', width: '100%', maxWidth: 320 },
  bigEmoji: { fontSize: 56, marginBottom: 8 },
  h1: { fontFamily: "'Baloo 2', 'Nunito', sans-serif", fontSize: 32, fontWeight: 800, margin: '0 0 16px', color: '#2B2440' },
  lead: { fontSize: 15, color: '#2B2440', opacity: 0.7, margin: '0 0 16px', fontWeight: 600 },
  subLead: { fontSize: 14, color: '#2B2440', opacity: 0.55, margin: '4px 0 0' },
  codeInput: { width: '100%', height: 52, borderRadius: 16, border: '3px solid #2B2440', background: '#FFFFFF', textAlign: 'center', fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', fontFamily: "'Baloo 2', sans-serif", color: '#2B2440', marginBottom: 12, boxShadow: '0 4px 0 #2B2440' },
  errorText: { fontSize: 13, color: '#FF6F61', fontWeight: 700, marginBottom: 8 },
  pendingText: { fontSize: 13, color: '#C98A1F', fontWeight: 700, marginBottom: 12 },
  successText: { fontSize: 14, color: '#0E7A60', fontWeight: 800, marginBottom: 12 },

  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 52, padding: '0 26px', borderRadius: 16, border: '3px solid #2B2440', background: '#FF6F61', color: '#fff', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 0 #2B2440', width: '100%', justifyContent: 'center' },

  gameHeader: { width: '100%', maxWidth: 480, display: 'flex', justifyContent: 'center', marginBottom: 20 },
  teamBadge: { color: '#fff', fontSize: 16, fontWeight: 800, padding: '8px 20px', borderRadius: 999, border: '3px solid #2B2440', boxShadow: '0 3px 0 #2B2440' },

  waitWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4, marginTop: '12vh', maxWidth: 280 },
  bigIcon: { width: 48, height: 48, color: '#9C6ADE', marginBottom: 12 },

  contentWrap: { width: '100%', maxWidth: 480 },
  allDoneWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, marginTop: '10vh' },
  celebrateWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, marginTop: '14vh', animation: 'celebratePop 0.5s ease-out' },
  celebrateEmoji: { fontSize: 72, marginBottom: 8, animation: 'celebrateBounce 0.6s ease-in-out infinite' },
  allDoneEmoji: { fontSize: 64, marginBottom: 8 },
  progressBar: { width: '100%', height: 12, background: '#F0E6D2', borderRadius: 999, overflow: 'hidden', marginBottom: 6, border: '2px solid #2B2440' },
  progressFill: { height: '100%', background: '#FF6F61', borderRadius: 999, transition: 'width 0.3s' },
  progressLabel: { fontSize: 13, color: '#2B2440', opacity: 0.65, marginBottom: 18, fontWeight: 700, textAlign: 'center' },
  raceHint: { fontSize: 12, color: '#9C6ADE', opacity: 0.8, marginTop: -10, marginBottom: 18, fontWeight: 700, textAlign: 'center' },

  challengeList: { display: 'flex', flexDirection: 'column', gap: 10 },
  challengeCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#FFFFFF', borderRadius: 16, border: '3px solid #2B2440', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', boxShadow: '0 3px 0 #2B2440' },
  challengeEmoji: { fontSize: 24, flexShrink: 0 },
  challengeTitle: { flex: 1, fontSize: 15, fontWeight: 700 },

  pillTodo: { width: 32, height: 32, borderRadius: '50%', background: '#F0E6D2', color: '#2B2440', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pillPending: { fontSize: 11, fontWeight: 800, color: '#C98A1F', background: '#FFF1D2', padding: '4px 10px', borderRadius: 999, flexShrink: 0 },
  pillApproved: { width: 32, height: 32, borderRadius: '50%', background: '#2EC4A6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pillRejected: { fontSize: 11, fontWeight: 800, color: '#FF6F61', background: '#FFE3DD', padding: '4px 10px', borderRadius: 999, flexShrink: 0 },

  backLink: { background: 'none', border: 'none', color: '#9C6ADE', fontSize: 14, fontWeight: 800, cursor: 'pointer', padding: 0, marginBottom: 16, fontFamily: 'inherit' },
  captureHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  captureEmoji: { fontSize: 32 },
  h2: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#2B2440', margin: 0 },
  h3: { fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 800, color: '#2B2440', margin: '20px 0 10px' },
  bodyText: { fontSize: 14, lineHeight: 1.6, color: '#2B2440', opacity: 0.75, margin: '8px 0 16px' },
  previewImg: { width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 18, marginBottom: 16, border: '3px solid #2B2440' },

  voteFullWrap: { width: '100%', maxWidth: 480 },
  voteEnterAnim: { animation: 'voteEnter 0.5s ease-out' },

  voteHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  voteStepIndicator: { fontSize: 13, fontWeight: 800, color: '#9C6ADE', textTransform: 'uppercase', letterSpacing: '0.04em' },
  voteTimer: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#FF6F61', background: '#FFFFFF', border: '2px solid #2B2440', borderRadius: 12, padding: '2px 14px' },

  voteChallengeTitle: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#2B2440', textAlign: 'center', margin: '0 0 4px' },
  voteHint: { fontSize: 13, color: '#2B2440', opacity: 0.6, textAlign: 'center', fontWeight: 600, margin: '0 0 16px' },

  revealWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 20 },
  revealBadge: { fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 800, color: '#2B2440', background: '#FFF3D6', border: '3px solid #2B2440', borderRadius: 999, padding: '6px 20px', marginBottom: 16 },
  revealImg: { width: '100%', maxWidth: 360, aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 24, border: '4px solid #2B2440', boxShadow: '0 6px 0 #2B2440', marginBottom: 14 },
  revealTeamName: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#2B2440' },
  revealVoteCount: { fontSize: 14, fontWeight: 700, color: '#2EC4A6', marginBottom: 14 },
  revealAutoText: { fontSize: 13, color: '#2B2440', opacity: 0.55, fontWeight: 600, marginBottom: 10 },

  carouselWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  carouselPhotoBox: { position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 24, overflow: 'hidden', border: '4px solid #2B2440', boxShadow: '0 6px 0 #2B2440', touchAction: 'pan-y' },
  carouselImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  carouselSelectedBadge: { position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, background: '#FFC53D', color: '#2B2440', fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 999, border: '2px solid #2B2440' },
  carouselStarIcon: { width: 14, height: 14 },
  carouselArrow: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', border: '2px solid #2B2440', background: 'rgba(255,255,255,0.85)', color: '#2B2440', fontSize: 22, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  carouselArrowLeft: { left: 10 },
  carouselArrowRight: { right: 10 },

  carouselFooter: { display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 10, marginBottom: 16 },
  carouselTeamName: { fontSize: 15, fontWeight: 800, color: '#2B2440' },
  carouselCounter: { fontSize: 13, fontWeight: 700, color: '#2B2440', opacity: 0.5 },

  voteThisBtn: { width: '100%', height: 52, borderRadius: 16, border: '3px solid #2B2440', background: '#4D96FF', color: '#fff', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 0 #2B2440', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  voteThisBtnSelected: { background: '#FFC53D', color: '#2B2440' },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },

  emptyHint: { fontSize: 14, color: '#2B2440', opacity: 0.5, padding: '20px 0', textAlign: 'center', fontStyle: 'italic' },
  iconXs: { width: 14, height: 14 },
  iconSm: { width: 18, height: 18 },
};

/* Injection ponctuelle de l'animation d'entrée en phase de vote */
if (typeof document !== 'undefined' && !document.getElementById('vote-enter-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vote-enter-keyframes';
  style.textContent = `
    @keyframes voteEnter { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes celebratePop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
    @keyframes celebrateBounce { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-12px) rotate(4deg); } }
  `;
  document.head.appendChild(style);
}
