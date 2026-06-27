/* ============================================================
   CONFIG SUPABASE — remplace ces 2 valeurs par les tiennes
   ============================================================ */
export const SUPABASE_URL = 'https://dybyxdghofgftlzjbqkl.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5Ynl4ZGdob2ZnZnRsempicWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDQ1MDMsImV4cCI6MjA5ODEyMDUwM30.0Ja1sGVcTs_n6PJU5FgzbGY_4I3ss-Ws0RcYsebtlYQ';

/* ============================================================
   Retry avec backoff exponentiel — utile sur connexion instable.
   Ne retente que les erreurs réseau ou serveur (5xx), jamais les
   erreurs de validation/permission (4xx) qui ne se résoudront pas
   en réessayant.
   ============================================================ */
async function withRetry(fn, { retries = 3, baseDelayMs = 800 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isClientError = e.status && e.status >= 400 && e.status < 500;
      if (isClientError || attempt === retries) throw e;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export async function sbFetch(path, options = {}) {
  return withRetry(async () => {
    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': options.prefer || 'return=representation',
          ...options.headers,
        },
      });
    } catch (networkError) {
      // Erreur réseau (pas de connexion) : on la laisse remonter pour être retentée
      throw networkError;
    }
    if (!res.ok) {
      const error = new Error(`Supabase error ${res.status}: ${await res.text()}`);
      error.status = res.status;
      throw error;
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  });
}

export async function sbUpload(bucket, filename, blob) {
  return withRetry(async () => {
    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': blob.type,
        },
        body: blob,
      });
    } catch (networkError) {
      throw networkError;
    }
    if (!res.ok) {
      const error = new Error(`Upload error ${res.status}: ${await res.text()}`);
      error.status = res.status;
      throw error;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
  });
}

export function compressImage(file, maxWidth = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function generatePartyCode() {
  const words = ['SOLEIL', 'AVENTURE', 'COPAINS', 'FORET', 'JUNGLE', 'PIRATE', 'TRESOR', 'EXPLO'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(10 + Math.random() * 89);
  return `${w}${n}`;
}

export const TEAM_COLORS = ['#FF6F61', '#2EC4A6', '#4D96FF', '#9C6ADE', '#FFC53D', '#FF8FB1'];

/* ============================================================
   MOT DE PASSE ADMIN — change cette valeur avant de déployer
   ============================================================ */
export const ADMIN_PASSWORD = 'aventure2026';

/* ============================================================
   Mélange aléatoire (Fisher-Yates)
   ============================================================ */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   BANQUE DE DÉFIS PRÉ-ÉCRITS
   ============================================================ */
export const CHALLENGE_BANK = [
  { title: "Câlin à un arbre", description: "Une photo où toute l'équipe fait un câlin à un arbre.", emoji: "🌳" },
  { title: "Tous allongés dans l'herbe", description: "Toute l'équipe allongée dans l'herbe sur la photo.", emoji: "🌱" },
  { title: "Tous avec une casquette", description: "Chaque membre de l'équipe porte une casquette sur la photo.", emoji: "🧢" },
  { title: "Demande en mariage aux toilettes", description: "Mets-toi en scène en train de faire une demande en mariage... dans les sanitaires.", emoji: "💍" },
  { title: "Pyramide humaine", description: "Toute l'équipe forme une pyramide humaine.", emoji: "🤸" },
  { title: "Photo avec un inconnu", description: "Prends une photo avec une personne que tu ne connais pas. Reste poli et demande la permission !", emoji: "🤝" },
  { title: "Photo avec un animateur", description: "Trouve un animateur et prends une photo avec lui.", emoji: "🎤" },
  { title: "Photo au city stade", description: "Une photo de l'équipe au city.", emoji: "⚽" },
  { title: "Photo avec un animal", description: "Trouve un animal (chien, oiseau, chat...) et prends une photo avec lui.", emoji: "🐶" },
  { title: "Objet rouge", description: "Trouve un objet rouge et prends une photo avec.", emoji: "🔴" },
  { title: "Imitation de statue", description: "Toute l'équipe imite une statue, immobile, pendant la photo.", emoji: "🗿" },
  { title: "Saut synchronisé", description: "Toute l'équipe sautille en même temps, photo prise en plein saut.", emoji: "🦘" },
  { title: "Tête à l'envers", description: "Une photo où tout le monde fait une grimace la tête en bas ou penchée.", emoji: "🙃" },
  { title: "Mode super-héros", description: "Toute l'équipe pose comme des super-héros.", emoji: "🦸" },
  { title: "Objet trouvé par terre", description: "Trouvez un objet insolite par terre et prenez la pose avec.", emoji: "🔍" },
  { title: "Plus grand sourire", description: "Une photo avec le sourire le plus grand possible, façon concours.", emoji: "😁" },
  { title: "Selfie improbable", description: "Un selfie avec toute l'équipe dans une position improbable.", emoji: "🤳" },
  { title: "Mini concert", description: "Faites semblant de jouer d'un instrument de musique imaginaire tous ensemble.", emoji: "🎸" },
  { title: "Photo d'ombres", description: "Une photo artistique en utilisant uniquement les ombres.", emoji: "🌳" },
  { title: "Déguisement improvisé", description: "Improvisez un déguisement avec ce que vous avez sous la main et prenez la photo.", emoji: "🎭" },
];
