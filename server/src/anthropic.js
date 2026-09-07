import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_ANTHROPIC_KEY } from './env.js';

const SYSTEM = `Tu es l'assistant pédagogique de ClassMemo, une app de révision pour de petites tablées d'étude (3–4 étudiant·es).
On te donne la transcription de notes de cours manuscrites. Tu produis un "kit de révision" bienveillant, clair et structuré, en français.

Réponds STRICTEMENT avec un unique objet JSON valide, sans texte autour, sans balises Markdown, sans commentaire.
Schéma attendu :
{
  "summary": "3 courts paragraphes de synthèse, séparés par \\n\\n",
  "keyPoints": ["3 points essentiels à retenir pour l'examen"],
  "analogy": { "title": "L'analogie de …", "body": "une métaphore concrète qui rend la notion centrale évidente" },
  "notions": [ { "term": "POC", "short": "définition en 5-8 mots" } ],   // 3 à 5 notions
  "readingTime": 5,                                                      // minutes, entier
  "flashcards": [ { "front": "question / terme", "back": "réponse concise", "tag": "Notion clé" } ], // 6 à 8
  "quiz": [ { "question": "…", "options": ["a","b","c","d"], "correctIndex": 1, "explanation": "…" } ], // exactement 5, 4 options chacune
  "capsule": {
    "notion": "Notion centrale — nom complet",
    "title": "Notion centrale — nom complet",
    "simpleTranslation": "traduction simple / mot à mot",
    "body": "explication pas à pas, ton rassurant",
    "analogyTitle": "L'analogie de …",
    "analogyBody": "métaphore filée",
    "keyPoints": ["3 points à retenir"],
    "challenge": { "question": "mini-défi de vérification", "options": ["…","…"], "correctIndex": 0 }
  }
}`;

function buildUserPrompt(text, course) {
  const meta = [
    course?.title && `Cours : ${course.title}`,
    course?.subjectName && `Matière : ${course.subjectName}`,
    course?.date && `Date : ${course.date}`,
    course?.note && `Note de l'étudiant·e au groupe : ${course.note}`,
  ]
    .filter(Boolean)
    .join('\n');
  return `${meta}\n\n--- Transcription des notes manuscrites ---\n${text || '(transcription vide)'}\n--- fin ---`;
}

function stripFences(s) {
  return s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
}

function safeParseJson(raw) {
  if (!raw) return null;
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeKit(k) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const clampIdx = (i, len) => {
    const n = Number(i) || 0;
    return n >= 0 && n < len ? n : 0;
  };
  const notions = arr(k.notions)
    .map((n) => ({ term: String(n.term || '').trim(), short: String(n.short || '').trim() }))
    .filter((n) => n.term)
    .slice(0, 6);
  const flashcards = arr(k.flashcards)
    .map((f) => ({
      front: String(f.front || '').trim(),
      back: String(f.back || '').trim(),
      tag: String(f.tag || 'Notion clé').trim() || 'Notion clé',
    }))
    .filter((f) => f.front && f.back)
    .slice(0, 10);
  const quiz = arr(k.quiz)
    .map((q) => {
      const options = arr(q.options).map((o) => String(o)).filter(Boolean);
      return {
        question: String(q.question || '').trim(),
        options,
        correctIndex: clampIdx(q.correctIndex, options.length || 1),
        explanation: String(q.explanation || '').trim(),
      };
    })
    .filter((q) => q.question && q.options.length >= 2)
    .slice(0, 8);
  const cap = k.capsule || {};
  const challenge = cap.challenge || {};
  const chOpts = arr(challenge.options).map((o) => String(o)).filter(Boolean);
  return {
    summary: String(k.summary || '').trim(),
    keyPoints: arr(k.keyPoints).map((s) => String(s).trim()).filter(Boolean).slice(0, 5),
    analogy: {
      title: String(k.analogy?.title || 'Comprendre simplement').trim(),
      body: String(k.analogy?.body || '').trim(),
    },
    notions,
    readingTime: Math.max(1, Math.round(Number(k.readingTime) || 4)),
    flashcards,
    quiz,
    capsule: {
      notion: String(cap.notion || notions[0]?.term || 'Notion centrale').trim(),
      title: String(cap.title || cap.notion || notions[0]?.term || 'Notion centrale').trim(),
      simpleTranslation: String(cap.simpleTranslation || '').trim(),
      body: String(cap.body || '').trim(),
      analogyTitle: String(cap.analogyTitle || "L'analogie de l'équipe").trim(),
      analogyBody: String(cap.analogyBody || k.analogy?.body || '').trim(),
      keyPoints: arr(cap.keyPoints).map((s) => String(s).trim()).filter(Boolean).slice(0, 4),
      challenge: {
        question: String(challenge.question || 'Vérifions ensemble en 5 secondes.').trim(),
        options: chOpts.length >= 2 ? chOpts : ['Oui', 'Non'],
        correctIndex: clampIdx(challenge.correctIndex, chOpts.length || 2),
      },
    },
  };
}

// ---------- Générateur heuristique local (sans clé API) ----------

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function heuristicKit(text, course) {
  const sents = sentences(text);
  const words = String(text || '').split(/\s+/).filter(Boolean).length;

  const notionLines = [];
  for (const line of String(text || '').split(/\n|•|- /)) {
    const m = line.match(/^\s*([A-ZÀ-Ÿ][\wÀ-ÿ'’().\- ]{1,44}?)\s*[:\-–]\s*(.{6,120})$/);
    if (m) notionLines.push({ term: m[1].trim(), short: m[2].trim().replace(/[.;]$/, '') });
  }
  const acronyms = [...new Set((String(text || '').match(/\b[A-Z]{2,6}\b/g) || []))];
  const notions = (notionLines.length ? notionLines : acronyms.map((a) => ({ term: a, short: 'Notion clé issue du cours' })))
    .filter((n, i, a) => a.findIndex((x) => x.term.toLowerCase() === n.term.toLowerCase()) === i)
    .slice(0, 5);
  if (!notions.length) notions.push({ term: course?.title || 'Notion du cours', short: 'À préciser lors de la relecture' });

  const keyish = sents.filter((s) => /\b(important|clé|retenir|attention|définit|objectif|permet|sert à)\b/i.test(s));
  const keyPoints = (keyish.length ? keyish : sents).slice(0, 3);

  const summaryParts = [];
  for (let i = 0; i < sents.length && summaryParts.length < 3; i += Math.max(1, Math.ceil(sents.length / 3))) {
    summaryParts.push(sents.slice(i, i + Math.ceil(sents.length / 3)).join(' '));
  }
  const summary = summaryParts.filter(Boolean).join('\n\n') || (text || 'Notes en attente de transcription.');

  const flashcards = notions.map((n) => ({ front: n.term, back: n.short, tag: 'Notion clé' }));
  for (const s of sents.slice(0, 4)) {
    if (flashcards.length >= 8) break;
    flashcards.push({ front: 'Que dit le cours à ce sujet ?', back: s, tag: 'Rappel' });
  }

  const quiz = sents.slice(0, 5).map((s) => ({
    question: `D'après les notes : « ${s.slice(0, 140)}${s.length > 140 ? '…' : ''} » — est-ce exact ?`,
    options: ['Vrai', 'Faux', 'Partiellement', 'Non abordé'],
    correctIndex: 0,
    explanation: 'Reformulation directe des notes du cours.',
  }));
  while (quiz.length < 3) {
    quiz.push({
      question: `« ${notions[0].term} » correspond à : ${notions[0].short} ?`,
      options: ['Vrai', 'Faux'],
      correctIndex: 0,
      explanation: 'Définition relevée dans les notes.',
    });
  }

  return {
    summary,
    keyPoints,
    analogy: {
      title: 'Comprendre simplement',
      body: `Retiens surtout « ${notions[0].term} » : ${notions[0].short}. Le reste du cours gravite autour de cette idée.`,
    },
    notions,
    readingTime: Math.max(2, Math.round(words / 200)),
    flashcards: flashcards.slice(0, 8),
    quiz: quiz.slice(0, 5),
    capsule: {
      notion: notions[0].term,
      title: notions[0].term,
      simpleTranslation: notions[0].short,
      body: `On reprend calmement : ${notions[0].term} — ${notions[0].short}. Pas de panique, c'est la brique de base du cours.`,
      analogyTitle: 'Une image pour retenir',
      analogyBody: `Imagine ${notions[0].term} comme le premier essai rapide avant de tout construire : on vérifie que l'idée tient.`,
      keyPoints: keyPoints.slice(0, 3),
      challenge: {
        question: `« ${notions[0].term} » sert à : ${notions[0].short} ?`,
        options: ['Oui, exactement', 'Non, pas du tout'],
        correctIndex: 0,
      },
    },
  };
}

// ---------- Point d'entrée ----------

export async function generateStudyKit({ apiKey, model, text, course }) {
  const key = apiKey || DEFAULT_ANTHROPIC_KEY;
  if (!key) return { ...heuristicKit(text, course), generatedBy: 'heuristique' };

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: model || 'claude-opus-5',
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildUserPrompt(text, course) }],
    });
    const raw = (msg.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const parsed = safeParseJson(raw);
    if (!parsed) return { ...heuristicKit(text, course), generatedBy: 'heuristique' };
    return { ...normalizeKit(parsed), generatedBy: 'claude' };
  } catch (err) {
    console.error('[anthropic] génération repliée sur heuristique :', err.message);
    return { ...heuristicKit(text, course), generatedBy: 'heuristique', error: err.message };
  }
}
