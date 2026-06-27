import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sbFetch, generatePartyCode, CHALLENGE_BANK } from './shared.js';

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
  check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  x: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  trophy: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 5H4a1 1 0 00-1 1v1a4 4 0 004 4M17 5h3a1 1 0 011 1v1a4 4 0 01-4 4"/></svg>,
  plus: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  trash: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0l-1 14a1 1 0 01-1 1H6a1 1 0 01-1-1L4 6"/></svg>,
  arrowRight: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  refresh: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  star: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>,
};

export default function AdminApp({ onExit }) {
  const [game, setGame] = useState(null);
  const [tab, setTab] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showWall, setShowWall] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const games = await sbFetch('games?order=created_at.desc&limit=1');
        if (games && games.length) {
          setGame(games[0]);
          setTab(games[0].phase === 'setup' ? 'setup' : games[0].phase === 'voting' ? 'vote' : games[0].phase === 'finished' ? 'scores' : 'live');
        } else {
          const created = await sbFetch('games', {
            method: 'POST',
            body: JSON.stringify({ name: 'Rallye Photo', phase: 'setup', party_code: generatePartyCode() }),
          });
          setGame(created[0]);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    init();
  }, []);

  // Compteur léger de photos en attente, utilisé pour le badge sur l'onglet Validation
  useEffect(() => {
    if (!game) return;
    let active = true;
    async function tick() {
      try {
        const pending = await sbFetch(`submissions?game_id=eq.${game.id}&status=eq.pending&select=id`);
        if (active) setPendingCount(pending ? pending.length : 0);
      } catch (e) { /* ignore, on retentera au prochain tick */ }
    }
    tick();
    const interval = setInterval(tick, 4000);
    return () => { active = false; clearInterval(interval); };
  }, [game?.id]);

  async function updatePhase(phase) {
    const patch = { phase };
    if (phase === 'voting') {
      // Repart toujours d'un état de vote propre, même si un résidu d'un test
      // précédent traînait en base (vote_started_at obsolète, etc.).
      patch.vote_order = [];
      patch.vote_index = 0;
      patch.vote_challenge_id = null;
      patch.vote_started_at = null;
      patch.vote_revealed = false;
    }
    await sbFetch(`games?id=eq.${game.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setGame({ ...game, ...patch });
    setTab(phase === 'voting' ? 'vote' : phase === 'finished' ? 'scores' : 'live');
  }

  function copyCode() {
    navigator.clipboard?.writeText(game.party_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <CenteredLoader label="Préparation de la partie..." />;
  if (!game) return <CenteredLoader label="Oups, erreur de connexion" />;

  if (showWall) return <PhotoWall game={game} onExit={() => setShowWall(false)} />;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div>
          <button style={S.exitLink} onClick={onExit}>← Accueil</button>
          <div style={S.eyebrow}>Espace animateur</div>
          <h1 style={S.h1}>Rallye photo</h1>
        </div>
        <div style={S.headerRight}>
          <button style={S.wallBtn} onClick={() => setShowWall(true)}>🖼️ Mur de photos</button>
          <div style={S.codeBadge} onClick={copyCode} title="Copier le code">
            <span style={S.codeBadgeLabel}>Code de partie</span>
            <span style={S.codeBadgeValue}>{game.party_code}</span>
            {copied && <span style={S.copiedTag}>Copié !</span>}
          </div>
        </div>
      </header>

      <nav style={S.tabs}>
        <TabBtn active={tab === 'setup'} onClick={() => setTab('setup')} emoji="📝">Défis</TabBtn>
        <TabBtn active={tab === 'live'} onClick={() => setTab('live')} emoji="📸" badge={pendingCount > 0 ? pendingCount : null}>Validation</TabBtn>
        <TabBtn active={tab === 'vote'} onClick={() => setTab('vote')} disabled={game.phase === 'setup'} emoji="⭐">Vote</TabBtn>
        <TabBtn active={tab === 'scores'} onClick={() => setTab('scores')} emoji="🏆">Classement</TabBtn>
      </nav>

      <main style={S.main}>
        {tab === 'setup' && <SetupView game={game} onLaunch={() => updatePhase('playing')} />}
        {tab === 'live' && <LiveView game={game} onStartVote={() => updatePhase('voting')} />}
        {tab === 'vote' && <VoteMonitorView game={game} onFinish={() => updatePhase('finished')} />}
        {tab === 'scores' && (
          <>
            <Leaderboard gameId={game.id} />
            <DeleteGameData game={game} onDeleted={onExit} />
          </>
        )}
      </main>
    </div>
  );
}

function PhotoWall({ game, onExit }) {
  const [data, loading] = usePolling(async () => {
    const [subs, teams, challenges] = await Promise.all([
      sbFetch(`submissions?game_id=eq.${game.id}&status=eq.approved&order=reviewed_at.desc`),
      sbFetch(`teams?game_id=eq.${game.id}`),
      sbFetch(`challenges?game_id=eq.${game.id}`),
    ]);
    return { subs: subs || [], teams: teams || [], challenges: challenges || [] };
  }, 4000, [game.id]);

  if (loading || !data) return <CenteredLoader label="Chargement du mur..." />;
  const { subs, teams, challenges } = data;
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));

  return (
    <div style={S.wallPage}>
      <div style={S.wallHeader}>
        <h1 style={S.wallTitle}>📸 Rallye photo — {subs.length} photo{subs.length > 1 ? 's' : ''} validée{subs.length > 1 ? 's' : ''}</h1>
        <button style={S.wallExitBtn} onClick={onExit}>Fermer</button>
      </div>
      {subs.length === 0 ? (
        <div style={S.wallEmpty}>Les photos validées apparaîtront ici au fur et à mesure.</div>
      ) : (
        <div style={S.wallGrid}>
          {subs.map((s) => (
            <div key={s.id} style={S.wallCard}>
              <img src={s.photo_url} alt="" style={S.wallImg} />
              <div style={S.wallCardMeta}>
                <span style={{ ...S.teamDot, background: teamById[s.team_id]?.color, borderColor: '#fff' }} />
                <span style={S.wallCardText}>{teamById[s.team_id]?.name} · {challengeById[s.challenge_id]?.emoji} {challengeById[s.challenge_id]?.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteGameData({ game, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteAll() {
    setDeleting(true);
    try {
      // L'ordre suit les dépendances : votes et submissions avant teams et challenges,
      // puis le jeu en dernier (les FK ON DELETE CASCADE feraient le travail,
      // mais on le fait explicitement pour rester robuste si le schéma change).
      await sbFetch(`votes?game_id=eq.${game.id}`, { method: 'DELETE' });
      await sbFetch(`submissions?game_id=eq.${game.id}`, { method: 'DELETE' });
      await sbFetch(`teams?game_id=eq.${game.id}`, { method: 'DELETE' });
      await sbFetch(`challenges?game_id=eq.${game.id}`, { method: 'DELETE' });
      await sbFetch(`games?id=eq.${game.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      console.error(e);
      setDeleting(false);
    }
  }

  return (
    <div style={S.dangerZone}>
      <h3 style={S.dangerTitle}>Fin de partie</h3>
      <p style={S.bodyText}>
        Une fois la partie terminée, tu peux supprimer toutes les données associées (défis, équipes, photos, votes).
        Cette action est irréversible.
      </p>
      {!confirming ? (
        <button style={S.dangerBtn} onClick={() => setConfirming(true)}>
          <Icon.trash style={S.iconSm} /> Supprimer les données de cette partie
        </button>
      ) : (
        <div style={S.confirmRow}>
          <span style={S.confirmText}>Confirmer la suppression définitive ?</span>
          <button style={S.dangerBtnConfirm} onClick={deleteAll} disabled={deleting}>
            {deleting ? 'Suppression...' : 'Oui, supprimer'}
          </button>
          <button style={S.cancelBtn} onClick={() => setConfirming(false)} disabled={deleting}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, disabled, onClick, emoji, badge, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...S.tabBtn, ...(active ? S.tabBtnActive : {}), ...(disabled ? S.tabBtnDisabled : {}) }}>
      <span style={S.tabEmoji}>{emoji}</span>{children}
      {badge != null && <span style={S.tabBadge}>{badge}</span>}
    </button>
  );
}

function SetupView({ game, onLaunch }) {
  const [existingChallenges, setExistingChallenges] = useState([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [teams, setTeams] = useState([]);

  const loadAll = useCallback(async () => {
    const [ch, tm] = await Promise.all([
      sbFetch(`challenges?game_id=eq.${game.id}&order=order_index.asc`),
      sbFetch(`teams?game_id=eq.${game.id}&order=created_at.asc`),
    ]);
    setExistingChallenges(ch || []);
    setTeams(tm || []);
  }, [game.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function addFromBank(item) {
    await sbFetch('challenges', {
      method: 'POST',
      body: JSON.stringify({
        game_id: game.id, title: item.title, description: item.description,
        emoji: item.emoji, order_index: existingChallenges.length,
        points_base: 10, points_vote: 5,
      }),
    });
    loadAll();
  }

  async function addCustom() {
    if (!customTitle.trim()) return;
    await sbFetch('challenges', {
      method: 'POST',
      body: JSON.stringify({
        game_id: game.id, title: customTitle, description: customDesc,
        emoji: '✨', order_index: existingChallenges.length,
        points_base: 10, points_vote: 5,
      }),
    });
    setCustomTitle(''); setCustomDesc('');
    loadAll();
  }

  async function removeChallenge(id) {
    await sbFetch(`challenges?id=eq.${id}`, { method: 'DELETE' });
    loadAll();
  }

  const usedTitles = new Set(existingChallenges.map((c) => c.title));
  const canLaunch = existingChallenges.length > 0;

  return (
    <div>
      <section style={S.section}>
        <h2 style={S.h2}>Défis sélectionnés ({existingChallenges.length})</h2>
        {existingChallenges.length === 0 && <EmptyHint text="Choisis des défis dans la banque ci-dessous, ou crée les tiens." />}
        <div style={S.selectedGrid}>
          {existingChallenges.map((c) => (
            <div key={c.id} style={S.selectedCard}>
              <span style={S.selectedEmoji}>{c.emoji || '✨'}</span>
              <span style={S.selectedTitle}>{c.title}</span>
              <button style={S.removeBtn} onClick={() => removeChallenge(c.id)}><Icon.trash style={S.iconXs} /></button>
            </div>
          ))}
        </div>
      </section>

      <section style={S.section}>
        <h2 style={S.h2}>Crée ton défi</h2>
        <div style={S.customRow}>
          <input style={S.input} placeholder="Titre du défi" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
          <input style={S.input} placeholder="Description (optionnel)" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
          <button style={S.addCustomBtn} onClick={addCustom}><Icon.plus style={S.iconSm} /></button>
        </div>
      </section>

      <section style={S.section}>
        <h2 style={S.h2}>Banque de défis</h2>
        <p style={S.bodyText}>Clique pour ajouter un défi à la partie.</p>
        <div style={S.bankGrid}>
          {CHALLENGE_BANK.map((item) => {
            const used = usedTitles.has(item.title);
            return (
              <button key={item.title} style={{ ...S.bankCard, ...(used ? S.bankCardUsed : {}) }} onClick={() => !used && addFromBank(item)} disabled={used}>
                <span style={S.bankEmoji}>{item.emoji}</span>
                <span style={S.bankTitle}>{item.title}</span>
                {used ? <Icon.check style={S.bankCheckIcon} /> : <Icon.plus style={S.bankPlusIcon} />}
              </button>
            );
          })}
        </div>
      </section>

      {teams.length > 0 && (
        <section style={S.section}>
          <h2 style={S.h2}>Équipes connectées ({teams.length})</h2>
          <div style={S.teamChipRow}>
            {teams.map((t) => (
              <span key={t.id} style={{ ...S.teamChip, background: t.color }}>{t.name}</span>
            ))}
          </div>
        </section>
      )}

      <div style={S.launchWrap}>
        {!canLaunch && <p style={S.launchHint}>Ajoute au moins un défi pour lancer la partie.</p>}
        <button style={{ ...S.primaryBtn, ...(canLaunch ? {} : S.btnDisabled) }} disabled={!canLaunch} onClick={onLaunch}>
          Lancer la partie <Icon.arrowRight style={S.iconSm} />
        </button>
      </div>
    </div>
  );
}

function EmptyHint({ text }) { return <div style={S.emptyHint}>{text}</div>; }

function LiveView({ game, onStartVote }) {
  const [data, loading] = usePolling(async () => {
    const [subs, challenges, teams] = await Promise.all([
      sbFetch(`submissions?game_id=eq.${game.id}&order=submitted_at.desc`),
      sbFetch(`challenges?game_id=eq.${game.id}`),
      sbFetch(`teams?game_id=eq.${game.id}`),
    ]);
    return { subs: subs || [], challenges: challenges || [], teams: teams || [] };
  }, 3000, [game.id]);

  if (loading || !data) return <CenteredLoader label="Chargement des photos..." />;
  const { subs, challenges, teams } = data;
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));
  const pending = subs.filter((s) => s.status === 'pending');
  const reviewed = subs.filter((s) => s.status !== 'pending');
  const approvedCount = subs.filter((s) => s.status === 'approved').length;

  async function review(id, status) {
    const sub = subs.find((s) => s.id === id);
    await sbFetch(`submissions?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status, reviewed_at: new Date().toISOString() }) });

    if (status === 'rejected' && sub) {
      const team = teams.find((t) => t.id === sub.team_id);
      if (team) {
        const queue = team.challenge_queue || [];
        const withoutChallenge = queue.filter((cid) => cid !== sub.challenge_id);
        const newQueue = [...withoutChallenge, sub.challenge_id];
        await sbFetch(`teams?id=eq.${team.id}`, { method: 'PATCH', body: JSON.stringify({ challenge_queue: newQueue }) });
      }
    }
  }

  return (
    <div>
      <div style={S.statsRow}>
        <StatBox label="À valider" value={pending.length} color="#FF6F61" />
        <StatBox label="Validées" value={approvedCount} color="#2EC4A6" />
        <StatBox label="Équipes" value={teams.length} color="#FFC53D" />
      </div>

      <button style={S.secondaryBtn} onClick={onStartVote}>
        Passer à la phase de vote <Icon.arrowRight style={S.iconSm} />
      </button>

      <h2 style={S.h2}>À valider</h2>
      {pending.length === 0 && <EmptyHint text="Aucune photo en attente pour le moment. Les photos envoyées par les équipes apparaîtront ici." />}
      <div style={S.photoGrid}>
        {pending.map((s) => (
          <div key={s.id} style={S.photoCard}>
            <img src={s.photo_url} alt="" style={S.photoImg} />
            <div style={S.photoMeta}>
              <span style={{ ...S.teamDot, background: teamById[s.team_id]?.color }} />
              <span style={S.photoMetaText}>{teamById[s.team_id]?.name} · {challengeById[s.challenge_id]?.emoji} {challengeById[s.challenge_id]?.title}</span>
            </div>
            <div style={S.photoActions}>
              <button style={S.rejectBtn} onClick={() => review(s.id, 'rejected')}><Icon.x style={S.iconSm} /></button>
              <button style={S.approveBtn} onClick={() => review(s.id, 'approved')}><Icon.check style={S.iconSm} /></button>
            </div>
          </div>
        ))}
      </div>

      {reviewed.length > 0 && (
        <>
          <h2 style={S.h2}>Déjà traitées</h2>
          <div style={S.photoGrid}>
            {reviewed.map((s) => (
              <div key={s.id} style={{ ...S.photoCard, opacity: 0.55 }}>
                <img src={s.photo_url} alt="" style={S.photoImg} />
                <div style={S.photoMeta}>
                  <span style={{ ...S.teamDot, background: teamById[s.team_id]?.color }} />
                  <span style={S.photoMetaText}>{teamById[s.team_id]?.name} · {challengeById[s.challenge_id]?.title}</span>
                </div>
                <div style={s.status === 'approved' ? S.badgeApproved : S.badgeRejected}>{s.status === 'approved' ? 'Validée' : 'Refusée'}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={S.statBox}>
      <div style={{ ...S.statValue, color }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function VoteMonitorView({ game, onFinish }) {
  const [data, loading] = usePolling(async () => {
    const [gameFresh, challenges, teams, subs, votes] = await Promise.all([
      sbFetch(`games?id=eq.${game.id}`),
      sbFetch(`challenges?game_id=eq.${game.id}`),
      sbFetch(`teams?game_id=eq.${game.id}`),
      sbFetch(`submissions?game_id=eq.${game.id}&status=eq.approved`),
      sbFetch(`votes?game_id=eq.${game.id}`),
    ]);
    return { game: gameFresh?.[0] || game, challenges: challenges || [], teams: teams || [], subs: subs || [], votes: votes || [] };
  }, 1500, [game.id]);

  const [durationInput, setDurationInput] = useState(30);
  const [justEntered, setJustEntered] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setJustEntered(false), 700);
    return () => clearTimeout(t);
  }, []);

  // Calcul sûr du temps restant, même avant que `data` soit chargé, pour respecter les règles des hooks
  const safeGame = data?.game;
  const safeElapsed = safeGame?.vote_started_at ? (Date.now() - new Date(safeGame.vote_started_at).getTime()) / 1000 : null;
  const safeRemaining = safeElapsed != null
    ? Math.max(0, Math.ceil((safeGame.vote_duration_seconds || 30) - safeElapsed))
    : null;

  useEffect(() => {
    // Garde-fou : on n'auto-révèle que si le vote a réellement démarré il y a peu
    // (moins de 2x la durée prévue). Un résidu de données avec un vieux timestamp
    // ne doit jamais déclencher une révélation instantanée au montage du composant.
    const isGenuinelyExpired = safeGame?.vote_duration_seconds && safeElapsed != null && safeElapsed < safeGame.vote_duration_seconds * 3;
    if (safeGame && safeRemaining === 0 && !safeGame.vote_revealed && safeGame.vote_started_at && isGenuinelyExpired) {
      sbFetch(`games?id=eq.${game.id}`, { method: 'PATCH', body: JSON.stringify({ vote_revealed: true }) }).catch(() => {});
    }
  }, [safeRemaining === 0, safeGame?.vote_revealed, safeGame?.vote_started_at]);

  if (loading || !data) return <CenteredLoader label="Chargement du vote..." />;
  const { game: freshGame, challenges, teams, subs, votes } = data;
  const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));

  const voteOrder = freshGame.vote_order || [];
  const voteIndex = freshGame.vote_index || 0;
  const currentChallengeId = voteOrder[voteIndex];
  const voteStarted = !!freshGame.vote_started_at;

  // Démarre la séquence de vote : calcule l'ordre des défis ayant des photos, démarre le 1er
  async function startVoteSequence() {
    const order = challenges
      .filter((c) => subs.some((s) => s.challenge_id === c.id))
      .map((c) => c.id);
    if (order.length === 0) return;
    await sbFetch(`games?id=eq.${game.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        vote_order: order,
        vote_index: 0,
        vote_challenge_id: order[0],
        vote_started_at: new Date().toISOString(),
        vote_duration_seconds: durationInput,
        vote_revealed: false,
      }),
    });
  }

  async function revealNow() {
    await sbFetch(`games?id=eq.${game.id}`, { method: 'PATCH', body: JSON.stringify({ vote_revealed: true }) });
  }

  async function nextChallenge() {
    const nextIndex = voteIndex + 1;
    if (nextIndex >= voteOrder.length) {
      onFinish();
      return;
    }
    await sbFetch(`games?id=eq.${game.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        vote_index: nextIndex,
        vote_challenge_id: voteOrder[nextIndex],
        vote_started_at: new Date().toISOString(),
        vote_revealed: false,
      }),
    });
  }

  // Pas encore démarré : écran de configuration
  if (!voteStarted) {
    const eligibleCount = challenges.filter((c) => subs.some((s) => s.challenge_id === c.id)).length;
    return (
      <div style={justEntered ? S.voteEnterAnim : {}}>
        {justEntered && (
          <div style={S.voteAnnounce}>
            <span style={S.voteAnnounceEmoji}>⭐</span>
            <span>C'est l'heure du vote !</span>
          </div>
        )}
        <p style={S.bodyText}>
          {eligibleCount} défi{eligibleCount > 1 ? 's' : ''} avec des photos validées seront soumis au vote, un par un.
          Choisis la durée du minuteur pour le premier défi (tu pourras forcer la révélation à tout moment).
        </p>
        <div style={S.durationRow}>
          <label style={S.durationLabel}>Durée du vote (secondes)</label>
          <input
            type="number"
            min="5"
            step="5"
            style={S.durationInput}
            value={durationInput}
            onChange={(e) => setDurationInput(Math.max(5, parseInt(e.target.value, 10) || 30))}
          />
        </div>
        <button style={{ ...S.primaryBtn, ...(eligibleCount === 0 ? S.btnDisabled : {}) }} disabled={eligibleCount === 0} onClick={startVoteSequence}>
          Démarrer le vote <Icon.arrowRight style={S.iconSm} />
        </button>
      </div>
    );
  }

  const currentChallenge = challengeById[currentChallengeId];
  if (!currentChallenge) return <CenteredLoader label="Chargement..." />;

  const candidateSubs = subs.filter((s) => s.challenge_id === currentChallengeId);
  const votesForChallenge = votes.filter((v) => v.challenge_id === currentChallengeId);
  const voteCountBySub = {};
  votesForChallenge.forEach((v) => { voteCountBySub[v.voted_for_submission_id] = (voteCountBySub[v.voted_for_submission_id] || 0) + 1; });
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  const elapsed = (Date.now() - new Date(freshGame.vote_started_at).getTime()) / 1000;
  const remaining = Math.max(0, Math.ceil(freshGame.vote_duration_seconds - elapsed));

  return (
    <div>
      <div style={S.voteHeaderRow}>
        <span style={S.voteStepIndicator}>Défi {voteIndex + 1} / {voteOrder.length}</span>
        {!freshGame.vote_revealed && <span style={S.voteTimer}>{remaining}s</span>}
      </div>
      <h2 style={{ ...S.h2, textAlign: 'center' }}>{currentChallenge.emoji} {currentChallenge.title}</h2>

      {!freshGame.vote_revealed ? (
        <>
          <p style={{ ...S.bodyText, textAlign: 'center' }}>{votesForChallenge.length} / {teams.length} équipes ont voté</p>
          <div style={S.photoGrid}>
            {candidateSubs.map((s) => (
              <div key={s.id} style={S.photoCard}>
                <img src={s.photo_url} alt="" style={S.photoImg} />
                <div style={S.photoMeta}>
                  <span style={{ ...S.teamDot, background: teamById[s.team_id]?.color }} />
                  <span style={S.photoMetaText}>{teamById[s.team_id]?.name} · {voteCountBySub[s.id] || 0} vote{(voteCountBySub[s.id] || 0) > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
          <button style={S.primaryBtn} onClick={revealNow}>
            Révéler le résultat maintenant <Icon.star style={S.iconSm} />
          </button>
        </>
      ) : (
        <VoteResultReveal
          candidateSubs={candidateSubs}
          voteCountBySub={voteCountBySub}
          teamById={teamById}
          onNext={nextChallenge}
          isLast={voteIndex + 1 >= voteOrder.length}
        />
      )}
    </div>
  );
}

function VoteResultReveal({ candidateSubs, voteCountBySub, teamById, onNext, isLast }) {
  const [autoAdvanceIn, setAutoAdvanceIn] = useState(6);

  useEffect(() => {
    if (autoAdvanceIn <= 0) { onNext(); return; }
    const t = setTimeout(() => setAutoAdvanceIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [autoAdvanceIn]);

  if (!candidateSubs || candidateSubs.length === 0) {
    return (
      <div style={S.revealWrap}>
        <p style={S.bodyText}>Aucune photo pour ce défi. Passage au suivant dans {autoAdvanceIn}s...</p>
        <button style={S.secondaryBtn} onClick={onNext}>
          {isLast ? 'Voir le classement' : 'Défi suivant'} <Icon.arrowRight style={S.iconSm} />
        </button>
      </div>
    );
  }

  const ranked = [...candidateSubs].sort((a, b) => (voteCountBySub[b.id] || 0) - (voteCountBySub[a.id] || 0));
  const winner = ranked[0];
  const winnerVotes = voteCountBySub[winner.id] || 0;

  return (
    <div style={S.revealWrap}>
      <div style={S.revealBadge}>🏆 Photo gagnante</div>
      <img src={winner.photo_url} alt="" style={S.revealImg} />
      <div style={S.revealTeamName}>{teamById[winner.team_id]?.name}</div>
      <div style={S.revealVoteCount}>{winnerVotes} vote{winnerVotes > 1 ? 's' : ''}</div>
      <p style={S.revealAutoText}>{isLast ? 'Classement final' : 'Défi suivant'} dans {autoAdvanceIn}s...</p>
      <button style={S.secondaryBtn} onClick={onNext}>
        {isLast ? 'Voir le classement' : 'Défi suivant'} <Icon.arrowRight style={S.iconSm} />
      </button>
    </div>
  );
}

export function Leaderboard({ gameId }) {
  const [data, loading] = usePolling(async () => {
    const [teams, subs, votes, challenges] = await Promise.all([
      sbFetch(`teams?game_id=eq.${gameId}`),
      sbFetch(`submissions?game_id=eq.${gameId}&status=eq.approved`),
      sbFetch(`votes?game_id=eq.${gameId}`),
      sbFetch(`challenges?game_id=eq.${gameId}`),
    ]);
    return { teams: teams || [], subs: subs || [], votes: votes || [], challenges: challenges || [] };
  }, 4000, [gameId]);

  if (loading || !data) return <CenteredLoader label="Calcul du classement..." />;
  const { teams, subs, votes, challenges } = data;
  const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));
  const voteCount = {};
  votes.forEach((v) => { voteCount[v.voted_for_submission_id] = (voteCount[v.voted_for_submission_id] || 0) + 1; });
  const score = {};
  teams.forEach((t) => { score[t.id] = 0; });
  subs.forEach((s) => {
    const ch = challengeById[s.challenge_id];
    if (ch) score[s.team_id] = (score[s.team_id] || 0) + ch.points_base + (voteCount[s.id] || 0) * ch.points_vote;
  });
  const ranked = teams.map((t) => ({ ...t, score: score[t.id] || 0 })).sort((a, b) => b.score - a.score);

  return (
    <div>
      <div style={S.trophyWrap}><Icon.trophy style={S.trophyIcon} /></div>
      <h2 style={{ ...S.h2, textAlign: 'center' }}>Classement</h2>
      <div style={S.leaderboardList}>
        {ranked.map((t, i) => (
          <div key={t.id} style={{ ...S.rankRow, ...(i === 0 ? S.rankRowFirst : {}) }}>
            <span style={S.rankNumber}>{i + 1}</span>
            <span style={{ ...S.teamDot, background: t.color }} />
            <span style={S.rankName}>{t.name}</span>
            <span style={S.rankScore}>{t.score} pts</span>
          </div>
        ))}
        {ranked.length === 0 && <EmptyHint text="Aucune équipe n'a encore rejoint la partie." />}
      </div>
    </div>
  );
}

export function CenteredLoader({ label }) {
  return (
    <div style={S.loaderWrap}>
      <Icon.refresh style={{ ...S.iconMd, animation: 'spin 1s linear infinite' }} />
      <span>{label}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#FFF8EF', fontFamily: "'Nunito', 'Quicksand', -apple-system, sans-serif", color: '#2B2440', padding: '24px 20px 56px' },
  exitLink: { background: 'none', border: 'none', color: '#9C6ADE', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: 0, marginBottom: 6, fontFamily: 'inherit' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, maxWidth: 760, margin: '0 auto 20px' },
  eyebrow: { fontSize: 13, fontWeight: 800, color: '#9C6ADE', textTransform: 'uppercase', letterSpacing: '0.08em' },
  h1: { fontFamily: "'Baloo 2', 'Nunito', sans-serif", fontSize: 34, fontWeight: 800, margin: '2px 0 0', color: '#2B2440' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  wallBtn: { height: 40, padding: '0 14px', borderRadius: 12, border: '2px solid #2B2440', background: '#FFFFFF', fontSize: 13, fontWeight: 800, color: '#2B2440', fontFamily: 'inherit', cursor: 'pointer' },
  codeBadge: { position: 'relative', background: '#FFFFFF', border: '3px solid #2B2440', borderRadius: 18, padding: '10px 18px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 0 #2B2440' },
  codeBadgeLabel: { display: 'block', fontSize: 11, fontWeight: 700, color: '#2B2440', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em' },
  codeBadgeValue: { display: 'block', fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#FF6F61', letterSpacing: '0.04em' },
  copiedTag: { position: 'absolute', top: -10, right: -10, background: '#2EC4A6', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999 },

  tabs: { display: 'flex', gap: 10, maxWidth: 760, margin: '0 auto 24px', flexWrap: 'wrap' },
  tabBtn: { position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 999, border: '3px solid #2B2440', background: '#FFFFFF', fontSize: 14, fontWeight: 800, color: '#2B2440', fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 3px 0 #2B2440' },
  tabBadge: { position: 'absolute', top: -8, right: -8, minWidth: 20, height: 20, borderRadius: 999, background: '#FF6F61', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #2B2440', padding: '0 4px' },
  tabBtnActive: { background: '#FFC53D' },
  tabBtnDisabled: { opacity: 0.35, cursor: 'not-allowed', boxShadow: 'none' },
  tabEmoji: { fontSize: 16 },

  main: { maxWidth: 760, margin: '0 auto' },
  section: { marginBottom: 32 },
  h2: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#2B2440', margin: '0 0 12px' },
  bodyText: { fontSize: 14, lineHeight: 1.6, color: '#2B2440', opacity: 0.75, marginBottom: 14 },
  emptyHint: { fontSize: 14, color: '#2B2440', opacity: 0.5, padding: '20px 0', textAlign: 'center', fontStyle: 'italic' },

  selectedGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 },
  selectedCard: { display: 'flex', alignItems: 'center', gap: 8, background: '#FFF1E0', border: '2px solid #2B2440', borderRadius: 14, padding: '10px 12px' },
  selectedEmoji: { fontSize: 20 },
  selectedTitle: { flex: 1, fontSize: 13, fontWeight: 700 },
  removeBtn: { width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'transparent', color: '#FF6F61', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  customRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: { flex: '1 1 160px', height: 44, borderRadius: 14, border: '3px solid #2B2440', background: '#FFFFFF', padding: '0 14px', fontSize: 14, fontFamily: 'inherit', color: '#2B2440' },
  addCustomBtn: { width: 44, height: 44, borderRadius: 14, border: '3px solid #2B2440', background: '#2EC4A6', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 0 #2B2440' },

  bankGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 },
  bankCard: { display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '2px solid rgba(43,36,64,0.10)', borderRadius: 14, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  bankCardUsed: { opacity: 0.45, cursor: 'not-allowed', background: '#F3F0E8' },
  bankEmoji: { fontSize: 20 },
  bankTitle: { flex: 1, fontSize: 13, fontWeight: 700 },
  bankPlusIcon: { width: 16, height: 16, color: '#4D96FF' },
  bankCheckIcon: { width: 16, height: 16, color: '#2EC4A6' },

  teamChipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  teamChip: { color: '#fff', fontSize: 13, fontWeight: 800, padding: '6px 14px', borderRadius: 999 },

  launchWrap: { marginTop: 8, paddingTop: 20, borderTop: '3px dashed rgba(43,36,64,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 },
  launchHint: { fontSize: 13, color: '#FF6F61', fontWeight: 700 },

  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 52, padding: '0 26px', borderRadius: 16, border: '3px solid #2B2440', background: '#FF6F61', color: '#fff', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 0 #2B2440' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 20px', borderRadius: 16, border: '3px solid #2B2440', background: '#4D96FF', color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 20, boxShadow: '0 3px 0 #2B2440' },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed', boxShadow: 'none' },

  statsRow: { display: 'flex', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, background: '#FFFFFF', border: '2px solid rgba(43,36,64,0.10)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' },
  statValue: { fontSize: 28, fontWeight: 800, fontFamily: "'Baloo 2', sans-serif" },
  statLabel: { fontSize: 12, color: '#2B2440', opacity: 0.6, marginTop: 2, fontWeight: 700 },

  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 8 },
  photoCard: { background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', border: '3px solid #2B2440', boxShadow: '0 4px 0 #2B2440' },
  photoImg: { width: '100%', height: 130, objectFit: 'cover', display: 'block', background: '#eee' },
  photoMeta: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px' },
  photoMetaText: { fontSize: 12, color: '#2B2440', opacity: 0.75, lineHeight: 1.3, fontWeight: 600 },
  photoActions: { display: 'flex', gap: 0, borderTop: '3px solid #2B2440' },
  approveBtn: { flex: 1, height: 42, border: 'none', borderRight: '3px solid #2B2440', background: '#2EC4A6', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { flex: 1, height: 42, border: 'none', background: '#FFE3DD', color: '#FF6F61', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badgeApproved: { margin: '0 10px 10px', fontSize: 11, fontWeight: 800, color: '#0E7A60', background: '#D7F5EC', padding: '4px 8px', borderRadius: 8, textAlign: 'center' },
  badgeRejected: { margin: '0 10px 10px', fontSize: 11, fontWeight: 800, color: '#FF6F61', background: '#FFE3DD', padding: '4px 8px', borderRadius: 8, textAlign: 'center' },

  voteProgressList: { display: 'flex', flexDirection: 'column', gap: 8 },
  voteProgressRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#FFFFFF', borderRadius: 14, border: '2px solid rgba(43,36,64,0.10)' },
  voteEnterAnim: { animation: 'adminVoteEnter 0.5s ease-out' },
  voteAnnounce: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', background: '#FFF3D6', border: '3px solid #2B2440', borderRadius: 16, padding: '14px 20px', marginBottom: 20, fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 800, color: '#2B2440' },
  voteAnnounceEmoji: { fontSize: 24, animation: 'adminStarPulse 0.8s ease-in-out infinite' },
  listTitle: { fontSize: 14, fontWeight: 700 },

  durationRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  durationLabel: { fontSize: 14, fontWeight: 700, color: '#2B2440' },
  durationInput: { width: 90, height: 44, borderRadius: 12, border: '3px solid #2B2440', textAlign: 'center', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', color: '#2B2440' },

  voteHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  voteStepIndicator: { fontSize: 13, fontWeight: 800, color: '#9C6ADE', textTransform: 'uppercase', letterSpacing: '0.04em' },
  voteTimer: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#FF6F61', background: '#FFFFFF', border: '2px solid #2B2440', borderRadius: 12, padding: '2px 14px' },

  revealWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', animation: 'adminVoteEnter 0.4s ease-out' },
  revealBadge: { fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 800, color: '#2B2440', background: '#FFF3D6', border: '3px solid #2B2440', borderRadius: 999, padding: '6px 20px', marginBottom: 16 },
  revealImg: { width: '100%', maxWidth: 360, aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 24, border: '4px solid #2B2440', boxShadow: '0 6px 0 #2B2440', marginBottom: 14 },
  revealTeamName: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#2B2440' },
  revealVoteCount: { fontSize: 14, fontWeight: 700, color: '#2EC4A6', marginBottom: 14 },
  revealAutoText: { fontSize: 13, color: '#2B2440', opacity: 0.55, fontWeight: 600, marginBottom: 10 },

  loaderWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '80px 0', color: '#2B2440', opacity: 0.6, fontSize: 14, fontWeight: 700 },
  iconXs: { width: 14, height: 14 },
  iconSm: { width: 18, height: 18 },
  iconMd: { width: 30, height: 30, color: '#FF6F61' },
  teamDot: { width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: '2px solid #2B2440' },

  trophyWrap: { display: 'flex', justifyContent: 'center', marginBottom: 4 },
  trophyIcon: { width: 52, height: 52, color: '#FFC53D' },
  leaderboardList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 },
  rankRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: '#FFFFFF', borderRadius: 16, border: '3px solid #2B2440' },
  rankRowFirst: { background: '#FFF3D6', boxShadow: '0 4px 0 #2B2440' },
  rankNumber: { fontFamily: "'Baloo 2', sans-serif", fontSize: 20, fontWeight: 800, color: '#FF6F61', width: 26 },
  rankName: { flex: 1, fontSize: 16, fontWeight: 800 },
  rankScore: { fontSize: 16, fontWeight: 800, color: '#2EC4A6' },

  dangerZone: { marginTop: 40, paddingTop: 24, borderTop: '3px dashed rgba(43,36,64,0.15)' },
  dangerTitle: { fontFamily: "'Baloo 2', sans-serif", fontSize: 18, fontWeight: 800, color: '#FF6F61', margin: '0 0 8px' },
  dangerBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 14, border: '2px solid #FF6F61', background: '#FFF1EE', color: '#FF6F61', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  confirmText: { fontSize: 14, fontWeight: 700, color: '#2B2440' },
  dangerBtnConfirm: { height: 40, padding: '0 16px', borderRadius: 12, border: 'none', background: '#FF6F61', color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' },
  cancelBtn: { height: 40, padding: '0 16px', borderRadius: 12, border: '2px solid rgba(43,36,64,0.2)', background: 'transparent', color: '#2B2440', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' },

  wallPage: { minHeight: '100vh', background: '#1A1530', padding: '24px 28px 48px', fontFamily: "'Nunito', 'Quicksand', -apple-system, sans-serif" },
  wallHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  wallTitle: { fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  wallExitBtn: { height: 40, padding: '0 18px', borderRadius: 12, border: '2px solid #fff', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' },
  wallEmpty: { color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', marginTop: 80, fontWeight: 600 },
  wallGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 },
  wallCard: { background: '#241D3D', borderRadius: 18, overflow: 'hidden', animation: 'wallCardIn 0.4s ease-out' },
  wallImg: { width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' },
  wallCardMeta: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' },
  wallCardText: { fontSize: 13, fontWeight: 700, color: '#fff' },
};

/* Injection ponctuelle des animations de la phase de vote (admin) */
if (typeof document !== 'undefined' && !document.getElementById('admin-vote-keyframes')) {
  const style = document.createElement('style');
  style.id = 'admin-vote-keyframes';
  style.textContent = `
    @keyframes adminVoteEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes adminStarPulse { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.2) rotate(8deg); } }
    @keyframes wallCardIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
  `;
  document.head.appendChild(style);
}
