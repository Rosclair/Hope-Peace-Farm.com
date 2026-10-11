/* =========================================================================
   Hope & Peace Farm — interactions du site en une page
   JavaScript natif, sans dépendance. Sans ce fichier, la page reste lisible,
   le menu s'ouvre, les liens WhatsApp et téléphone fonctionnent, et la
   landing s'affiche à son état final.
   ========================================================================= */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const hasIO = 'IntersectionObserver' in window;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Numéro WhatsApp : un seul endroit, l'attribut data-wa de <html> */
  const WA = (root.dataset.wa || '').replace(/[^0-9A-Za-z]/g, '');
  const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

  /* Dates à l'heure de Douala (UTC+1, sans heure d'été) */
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const isoDouala = (offsetDays = 0) => new Date(Date.now() + 36e5 + offsetDays * 864e5).toISOString().slice(0, 10);
  const TODAY = isoDouala();
  const MAX_DATE = isoDouala(365);
  const frDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
  };

  const storage = (() => {
    try {
      const k = '__hpf';
      sessionStorage.setItem(k, k);
      sessionStorage.removeItem(k);
      return sessionStorage;
    } catch (e) {
      return null;
    }
  })();
  const save = (key, value) => { try { storage && storage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage plein ou bloqué */ } };
  const load = (key) => { try { return storage ? JSON.parse(storage.getItem(key) || 'null') : null; } catch (e) { return null; } };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- 1. Bandeau et bloc des Fêtes ---------- */
  const fetesLink = $('#fetes-reserver');
  if (fetesLink && root.classList.contains('fetes-garanti') && root.dataset.fetesDeadline) {
    fetesLink.href = waLink(`Bonjour Hope & Peace Farm, je souhaite réserver mes poulets pour les fêtes (prix garanti avant le ${frDate(root.dataset.fetesDeadline)}).`);
  }

  /* ---------- 2. Menu mobile ---------- */
  const menu = $('.menu');
  if (menu) {
    const toggle = $('summary', menu);
    const behind = $$('body > main, body > footer, body > .bar, body > .banner, .brand, .skip-link');
    menu.addEventListener('toggle', () => behind.forEach((el) => el.toggleAttribute('inert', menu.open)));
    doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        toggle.focus();
      }
    });
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) menu.open = false;
    });
    window.matchMedia('(min-width: 70em)').addEventListener('change', (event) => {
      if (event.matches) menu.open = false;
    });
  }

  /* ---------- 3. Section en cours dans le menu ---------- */
  const navLinks = $$('.nav__link, .menu__link');
  if (hasIO && navLinks.length) {
    const sections = ['ceremonies', 'poulets', 'professionnels', 'livraison', 'la-ferme', 'questions']
      .map((id) => doc.getElementById(id))
      .filter(Boolean);
    const visible = new Set();
    const mark = () => {
      const current = sections.find((s) => visible.has(s));
      navLinks.forEach((link) => {
        const match = current && link.getAttribute('href') === `#${current.id}`;
        if (match) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      mark();
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- 4. Barre fixe WhatsApp / Appeler ----------
     Masquée tant qu'un bouton principal ou le formulaire est visible, et pendant
     la saisie. Sur la landing épinglée, les boutons du héros comptent comme
     partis dès que le texte s'est effacé (classe .is-cta-off posée en 8). */
  let barUpdate = () => {};
  const bar = $('.bar');
  if (bar) {
    const watched = new Set();
    let typing = false;
    let timer = 0;
    const ctaShown = () => Array.from(watched).some((el) => !el.closest('.is-cta-off'));
    barUpdate = () => bar.classList.toggle('is-hidden', ctaShown() || typing);

    if (hasIO) {
      const watch = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? watched.add(e.target) : watched.delete(e.target)));
        barUpdate();
        bar.classList.add('is-ready');
      });
      [...$$('[data-primary-cta]'), $('.request__card')].filter(Boolean).forEach((el) => watch.observe(el));
    } else {
      bar.classList.add('is-ready');
    }

    const isTextField = (el) => el instanceof Element && el.matches('textarea, input[type="text"], input[type="date"], input[type="tel"], input:not([type])');
    doc.addEventListener('focusin', (event) => {
      if (!isTextField(event.target)) return;
      clearTimeout(timer);
      typing = true;
      barUpdate();
    });
    doc.addEventListener('focusout', (event) => {
      if (!isTextField(event.target)) return;
      timer = setTimeout(() => { typing = false; barUpdate(); }, 100);
    });
  }

  /* ---------- 5. Mentions légales et confidentialité ---------- */
  const openDetailsFromHash = () => {
    const target = location.hash && doc.getElementById(location.hash.slice(1));
    if (target && target.tagName === 'DETAILS') target.open = true;
  };
  $$('[data-open-details]').forEach((link) => link.addEventListener('click', () => {
    const target = doc.getElementById(link.getAttribute('href').slice(1));
    if (target) target.open = true;
  }));
  window.addEventListener('hashchange', openDetailsFromHash);
  openDetailsFromHash();

  /* ---------- 6. Votre demande : onglets et formulaires ----------
     Préparés à l'approche du formulaire, ou tout de suite si l'adresse y mène
     ou si l'on touche un lien vers la demande : le premier affichage reste léger. */
  const card = $('.request__card');
  const HASH_TO_TYPE = { '#devis': 'ceremonie', '#commande': 'poulets', '#essai': 'pro' };
  let requestReady = false;
  const startRequest = () => {
    if (requestReady || !card) return;
    requestReady = true;
    initRequest(card);
  };
  if (card) {
    if (!hasIO || HASH_TO_TYPE[location.hash] || location.hash === '#demande') {
      startRequest();
    } else {
      const near = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          near.disconnect();
          startRequest();
        }
      }, { rootMargin: '800px 0px' });
      near.observe(card);
      /* Phase de capture : le formulaire est prêt avant que le lien touché ne réagisse */
      doc.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('[data-demande], a[href="#demande"]')) startRequest();
      }, true);
      window.addEventListener('hashchange', startRequest);
      /* Toucher ou atteindre au clavier un élément du formulaire : prêt avant le « click » */
      card.addEventListener('pointerdown', startRequest, true);
      card.addEventListener('focusin', startRequest, true);
    }
  }

  function initRequest(card) {

  const tabs = $$('input[name="type-demande"]', card);
  const forms = Object.fromEntries($$('.rform', card).map((f) => [f.dataset.form, f]));

  const selectType = (type, persist = true) => {
    if (!forms[type]) return;
    tabs.forEach((t) => { t.checked = t.value === type; });
    Object.entries(forms).forEach(([key, f]) => f.classList.toggle('is-current', key === type));
    if (persist) save('hpf-type', type);
  };

  tabs.forEach((t) => t.addEventListener('change', () => selectType(t.value)));
  $$('[data-demande]').forEach((link) => link.addEventListener('click', () => selectType(link.dataset.demande)));

  window.addEventListener('hashchange', () => {
    if (HASH_TO_TYPE[location.hash]) selectType(HASH_TO_TYPE[location.hash]);
  });
  selectType(HASH_TO_TYPE[location.hash] || load('hpf-type') || 'ceremonie', false);

  /* Bornes des champs date */
  $$('input[data-date]', card).forEach((input) => {
    input.min = TODAY;
    input.max = MAX_DATE;
  });

  const REQUIRED = {
    ceremonie: 'Ce champ est nécessaire pour préparer votre devis.',
    poulets: 'Ce champ est nécessaire pour préparer votre commande.',
    pro: 'Ce champ est nécessaire pour préparer votre livraison d’essai.',
  };

  const PREP = {
    vivant: ['vivant', 'vivants'],
    pret: ['prêt à cuire', 'prêts à cuire'],
    sauce: ['découpé pour la sauce', 'découpés pour la sauce'],
    braise: ['découpé pour la braise', 'découpés pour la braise'],
  };
  const CEREMONIE = {
    funerailles: 'des funérailles',
    mariage: 'un mariage',
    dot: 'une dot',
    bapteme: 'un baptême',
    retour: 'un retour au village',
    autre: 'une cérémonie',
  };
  const ANNONCES = 'J’accepte de recevoir vos annonces (deux messages par mois au plus).';

  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const cut = (v, n) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

  const compose = (type, data) => {
    const extra = clean(data.precisions);
    const nom = clean(data.nom);
    let text = '';
    if (type === 'poulets') {
      const n = parseInt(data.nombre, 10);
      const prep = (PREP[data.preparation] || ['', ''])[n > 1 ? 1 : 0];
      const reception = data.reception === 'livraison' ? `livraison à ${clean(data.lieu)}` : 'retrait à la ferme';
      text = `Bonjour Hope & Peace Farm, je souhaite commander ${n} ${n > 1 ? 'poulets' : 'poulet'} ${prep}, pour le ${frDate(data.date)}, ${reception}. Nom\u00a0: ${nom}.`;
      if (extra) text += ` Précision\u00a0: ${cut(extra, 300)}`;
    } else if (type === 'ceremonie') {
      const quand = data.date_inconnue ? '(date à confirmer)' : `le ${frDate(data.date)}`;
      text = `Bonjour Hope & Peace Farm, je prépare ${CEREMONIE[data.ceremonie] || 'une cérémonie'} ${quand} à ${clean(data.lieu)}, pour ${data.invites} invités. Je souhaite un devis. Nom\u00a0: ${nom}, j’habite à ${clean(data.residence)}.`;
      if (extra) text += ` Précisions\u00a0: ${cut(extra, 300)}`;
    } else {
      text = `Bonjour Hope & Peace Farm, je souhaite une livraison d’essai pour ${clean(data.etablissement)} (${data.type}) à ${clean(data.ville)}. Besoin\u00a0: ${data.volume} poulets par semaine, ${data.preparation}. Contact\u00a0: ${clean(data.contact)}.`;
      if (extra) text += ` Précisions\u00a0: ${cut(extra, 300)}`;
    }
    if (data.annonces) text += `\n${ANNONCES}`;
    return text;
  };

  const thanks = (type, data) => {
    const ready = 'Votre demande est prête. Le bouton ci-dessous ouvre WhatsApp avec le récapitulatif\u00a0: appuyez sur «\u00a0Envoyer\u00a0».';
    if (type === 'poulets') return `Merci ${clean(data.nom)}\u00a0! ${ready} Nous vous répondons avec le prix et la disponibilité.`;
    if (type === 'ceremonie') return `Merci ${clean(data.nom)}. ${ready} Nous vous envoyons votre devis écrit sous 24\u00a0h.`;
    return `Merci. ${ready} Nous vous contactons sous 24\u00a0h pour organiser votre livraison d’essai.`;
  };

  Object.entries(forms).forEach(([type, form]) => {
    const steps = $$('.rstep', form);
    const progressNow = $('[data-step-now]', form);
    const meter = $('.progress__bar span', form);
    const summary = $('.errors', form);
    const done = $('.done', form);
    let index = 0;

    summary.tabIndex = -1;
    $$('.field', form).forEach((wrapper, i) => {
      const error = $('.field__error', wrapper);
      if (error) error.id = `${type}-err-${i}`;
      $$('input[type="radio"]', wrapper).forEach((radio, j) => {
        if (!radio.id) radio.id = `${type}-${radio.name}-${j}`;
      });
    });

    const valuesOf = () => {
      const data = {};
      new FormData(form).forEach((value, key) => { data[key] = value; });
      return data;
    };

    /* Brouillon gardé le temps de la visite */
    const draftKey = `hpf-form-${type}`;
    const restore = load(draftKey);
    if (restore) {
      Array.from(form.elements).forEach((el) => {
        if (!el.name || !(el.name in restore)) return;
        if (el.type === 'radio') el.checked = restore[el.name] === el.value;
        else if (el.type === 'checkbox') el.checked = Boolean(restore[el.name]);
        else el.value = restore[el.name];
      });
    }
    const keep = () => {
      save(draftKey, valuesOf());
      save('hpf-type', type);
    };
    form.addEventListener('input', keep);
    form.addEventListener('change', keep);

    /* Compteur − / + */
    $$('[data-count]', form).forEach((button) => button.addEventListener('click', () => {
      const input = $('input', button.parentElement);
      const now = parseInt(input.value, 10) || 0;
      input.value = String(Math.min(9999, Math.max(1, now + Number(button.dataset.count))));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }));

    const labelOf = (wrapper) => clean(($('.field__label', wrapper) || {}).textContent).replace(/\s*\?$/, ' ?');

    const check = (wrapper) => {
      const data = valuesOf();
      const name = wrapper.dataset.field;
      const radios = $$('input[type="radio"]', wrapper);
      if (radios.length) return radios.some((r) => r.checked) ? '' : REQUIRED[type];

      const input = $('input:not([type="checkbox"]), textarea', wrapper);
      if (!input) return '';
      const value = input.value.trim();
      if (type === 'poulets' && name === 'lieu' && data.reception !== 'livraison') return '';
      if (type === 'ceremonie' && name === 'date' && data.date_inconnue) return '';
      if (!value) return input.required || name === 'lieu' ? REQUIRED[type] : '';
      if (name === 'nombre' && !/^[1-9][0-9]{0,3}$/.test(value)) return 'Indiquez un nombre de poulets, par exemple 10.';
      if (input.type === 'date') {
        if (value < TODAY) return 'Choisissez une date à partir d’aujourd’hui.';
        if (value > MAX_DATE) return 'Choisissez une date dans les douze prochains mois.';
      }
      return '';
    };

    const show = (wrapper, message) => {
      const error = $('.field__error', wrapper);
      const controls = $$('input:not([type="checkbox"]), textarea', wrapper);
      wrapper.toggleAttribute('data-invalid', Boolean(message));
      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }
      controls.forEach((c) => {
        if (!('baseDescribedby' in c.dataset)) c.dataset.baseDescribedby = c.getAttribute('aria-describedby') || '';
        const base = c.dataset.baseDescribedby;
        if (message) {
          c.setAttribute('aria-invalid', 'true');
          if (c.type !== 'radio' && error) c.setAttribute('aria-describedby', `${base} ${error.id}`.trim());
        } else {
          c.removeAttribute('aria-invalid');
          if (base) c.setAttribute('aria-describedby', base);
          else c.removeAttribute('aria-describedby');
        }
      });
      if (wrapper.tagName === 'FIELDSET' && error) {
        if (message) wrapper.setAttribute('aria-describedby', error.id);
        else wrapper.removeAttribute('aria-describedby');
      }
    };

    const validateStep = (step) => {
      const problems = [];
      $$('.field', step).forEach((wrapper) => {
        if (wrapper.offsetParent === null && !wrapper.matches('.field--livraison')) return;
        const message = check(wrapper);
        show(wrapper, message);
        if (message) problems.push({ wrapper, message });
      });
      const list = $('ul', summary);
      list.textContent = '';
      problems.forEach(({ wrapper, message }) => {
        const target = $('input:not([type="checkbox"]), textarea', wrapper);
        const li = doc.createElement('li');
        const a = doc.createElement('a');
        a.href = `#${target.id}`;
        a.textContent = `${labelOf(wrapper)} : ${message}`;
        a.addEventListener('click', (event) => {
          event.preventDefault();
          target.focus();
        });
        li.append(a);
        list.append(li);
      });
      summary.hidden = problems.length === 0;
      if (problems.length) summary.focus();
      return problems.length === 0;
    };

    /* Une erreur affichée se met à jour dès que la réponse change */
    form.addEventListener('change', (event) => {
      const wrapper = event.target.closest('.field');
      if (wrapper && wrapper.hasAttribute('data-invalid')) show(wrapper, check(wrapper));
      if (event.target.name === 'date_inconnue') {
        const dateField = event.target.closest('.field');
        if (dateField.hasAttribute('data-invalid')) show(dateField, check(dateField));
      }
    });
    /* Un champ en erreur se corrige pendant la frappe : le message disparaît
       tout de suite, et la mise en page ne bouge pas au moment où l'on touche
       le champ suivant (sinon le toucher peut tomber à côté). */
    form.addEventListener('input', (event) => {
      const wrapper = event.target.closest && event.target.closest('.field');
      if (wrapper && wrapper.hasAttribute('data-invalid')) show(wrapper, check(wrapper));
    });

    const goTo = (next, focus = true) => {
      index = Math.max(0, Math.min(steps.length - 1, next));
      steps.forEach((s, i) => s.classList.toggle('is-active', i === index));
      progressNow.textContent = String(index + 1);
      meter.style.setProperty('--progress', String((index + 1) / steps.length));
      summary.hidden = true;
      if (focus) $('.rstep__title', steps[index]).focus();
    };

    const finish = () => {
      const data = valuesOf();
      const message = compose(type, data);
      $('[data-done-text]', done).textContent = thanks(type, data);
      const extra = $('[data-done-extra]', done);
      if (extra) extra.hidden = data.ceremonie !== 'funerailles';
      $('[data-done-message]', done).textContent = message;
      $('[data-done-wa]', done).href = waLink(message);
      const fallback = $('.done__fallback', done);
      fallback.value = message;
      fallback.hidden = true;
      $$('.rform__intro, .progress, .errors, .rstep', form).forEach((el) => { el.hidden = true; });
      done.hidden = false;
      $('.done__title', done).focus();
    };

    $$('[data-next]', form).forEach((button) => button.addEventListener('click', () => {
      if (validateStep(steps[index])) goTo(index + 1);
    }));
    $$('[data-prev]', form).forEach((button) => button.addEventListener('click', () => goTo(index - 1)));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validateStep(steps[index])) return;
      if (index < steps.length - 1) goTo(index + 1);
      else finish();
    });

    $('[data-edit]', done).addEventListener('click', () => {
      done.hidden = true;
      $$('.rform__intro, .progress, .rstep', form).forEach((el) => { el.hidden = false; });
      goTo(0);
    });

    /* Copier le message */
    const copyButton = $('[data-copy]', done);
    const copyLabel = $('span', copyButton);
    copyButton.addEventListener('click', async () => {
      const text = $('[data-done-message]', done).textContent;
      try {
        await navigator.clipboard.writeText(text);
        copyLabel.textContent = 'Message copié';
        setTimeout(() => { copyLabel.textContent = 'Copier le message'; }, 2000);
      } catch (e) {
        const fallback = $('.done__fallback', done);
        fallback.hidden = false;
        fallback.focus();
        fallback.select();
        copyLabel.textContent = 'Appuyez longuement sur le message pour le copier.';
      }
    });

    goTo(0, false);
  });
  }

  /* ---------- 7. Aide au développement ----------
     En local seulement : rappelle ce qui reste à renseigner avant la mise en ligne. */
  if (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    const todo = [];
    if (/X/.test(root.dataset.wa || '')) todo.push('numéro WhatsApp : remplacer le numéro d’exemple');
    if ($('a[href*="YYYYYYYY"]')) todo.push('numéro d’appel : remplacer le numéro d’exemple');
    const blanks = $$('.todo').length;
    if (blanks) todo.push(`${blanks} mentions légales à renseigner`);
    if (todo.length) console.info(`[Hope & Peace Farm] À compléter avant la mise en ligne :\n- ${todo.join('\n- ')}`);
  }

  /* ---------- 8. Landing épinglée au défilement ----------
     La scène du héros reste fixe pendant ~2 écrans de défilement. Le script ne
     fait que lire la position de défilement et poser des variables CSS
     (--dock, --out, --card, --live, --s, --f, --foot) : le style décide du
     rendu, uniquement en transform et opacity. Mobile : l'emblème se range
     dans l'en-tête, le texte monte puis s'efface, le suivi arrive et ses
     étapes se cochent. Ordinateur : même récit, texte fixe à gauche. */
  const hero = $('.hero');
  const stage = $('.hero__stage');
  const heroText = $('.hero__text');
  const emblem = $('.hero__emblem');
  const suivi = $('.suivi');
  const suiviSteps = $$('.suivi__step');
  const header = $('.header');
  const brandLogo = $('.brand__logo');
  const dockLogo = $('.dock-logo');
  const desktopMQ = window.matchMedia('(min-width: 64em)');

  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const bell = (t) => Math.sin(Math.PI * t);

  /* Calendrier du récit, en fraction du défilement épinglé (0 → 1) */
  const PLAN = {
    mobile: { dock: [0.02, 0.2], out: [0.27, 0.41], card: [0.41, 0.58], steps: [0.6, 0.91], foot: [0.91, 0.97] },
    desktop: { live: [0, 0.2], dock: [0.2, 0.42], card: [0.4, 0.58], steps: [0.6, 0.91], foot: [0.91, 0.97], hint: [0, 0.05] },
  };
  const HERO_VARS = ['--out', '--card', '--card-o', '--live', '--hint'];

  let geo = { total: 0, headerH: 0, desktop: false };
  let lastP = -1;
  let dockState = '';
  let dockSize = 0;
  let ctaOff = false;

  const scrollyOn = () => root.classList.contains('scrolly');
  const setVar = (el, name, value) => el.style.setProperty(name, value.toFixed(4));

  const measure = () => {
    geo = {
      total: Math.max(1, hero.offsetHeight - stage.offsetHeight),
      headerH: header.offsetHeight,
      desktop: desktopMQ.matches,
    };
  };

  /* Le texte (une fois l'emblème rangé) et le suivi doivent tenir dans la scène,
     même avec une police agrandie ; sinon, page statique. */
  const fits = () => {
    const room = stage.clientHeight;
    if (!room) return false;
    if (geo.desktop) return heroText.offsetHeight <= room - 48 && suivi.offsetHeight <= room - 32;
    return heroText.offsetHeight + 16 <= room && suivi.offsetHeight <= room - 24;
  };

  const resetLanding = () => {
    HERO_VARS.forEach((v) => hero.style.removeProperty(v));
    root.style.removeProperty('--dock');
    root.style.removeProperty('--brand');
    suiviSteps.forEach((li) => { li.style.removeProperty('--s'); li.style.removeProperty('--f'); });
    suivi.style.removeProperty('--foot');
    root.classList.remove('docking', 'docked');
    if (heroText) heroText.classList.remove('is-cta-off');
    dockState = '';
    lastP = -1;
    if (ctaOff) { ctaOff = false; barUpdate(); }
  };

  const placeDock = (t, from, to) => {
    const state = t <= 0 ? 'idle' : (t >= 1 ? 'docked' : 'docking');
    if (state !== dockState) {
      dockState = state;
      root.classList.toggle('docking', state === 'docking');
      root.classList.toggle('docked', state === 'docked');
    }
    if (state !== 'docking' || !from || !to || !from.width || !to.width) return;
    if (dockSize !== from.width) {
      dockSize = from.width;
      dockLogo.style.width = `${from.width}px`;
      dockLogo.style.height = `${from.width}px`;
    }
    /* Mobile : trajet courbe, le logo glisse d'abord vers la gauche puis monte
       dans sa place (il arrive par-dessous au lieu de passer sur le nom).
       Ordinateur : ligne droite, dans l'espace libre au-dessus du titre. */
    const curved = !geo.desktop;
    const tx = curved ? 1 - (1 - t) * (1 - t) : t;
    const ty = curved ? t * t : t;
    const x = from.left + (to.left - from.left) * tx;
    const y = from.top + (to.top - from.top) * ty;
    const s = 1 + (to.width / from.width - 1) * t;
    dockLogo.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
  };

  const renderLanding = () => {
    if (!hero || !scrollyOn()) return;
    /* Lectures d'abord, écritures ensuite : aucun aller-retour de mise en page */
    const top = hero.getBoundingClientRect().top;
    const p = clamp((geo.headerH - top) / geo.total, 0, 1);
    if (Math.abs(p - lastP) < 0.0001) return;
    lastP = p;
    const plan = geo.desktop ? PLAN.desktop : PLAN.mobile;
    const dock = easeInOut(seg(p, plan.dock[0], plan.dock[1]));
    const docking = dock > 0 && dock < 1;
    const from = docking ? emblem.getBoundingClientRect() : null;
    const to = docking ? brandLogo.getBoundingClientRect() : null;

    setVar(root, '--dock', dock); /* sur <html> : lu aussi par l'en-tête */
    setVar(root, '--brand', easeOut(seg(p, plan.dock[0], plan.dock[0] + (plan.dock[1] - plan.dock[0]) * 0.6)));
    setVar(hero, '--card', easeOut(seg(p, plan.card[0], plan.card[1])));
    setVar(hero, '--card-o', seg(p, plan.card[0], plan.card[0] + (plan.card[1] - plan.card[0]) * 0.55));
    if (plan.out) setVar(hero, '--out', easeInOut(seg(p, plan.out[0], plan.out[1])));
    if (plan.live) setVar(hero, '--live', bell(seg(p, plan.live[0], plan.live[1])));
    if (plan.hint) setVar(hero, '--hint', 1 - seg(p, plan.hint[0], plan.hint[1]));

    const [sa, sb] = plan.steps;
    const w = (sb - sa) / suiviSteps.length;
    suiviSteps.forEach((li, i) => {
      const a = sa + i * w;
      setVar(li, '--s', easeOut(seg(p, a, a + w * 0.55)));
      setVar(li, '--f', seg(p, a + w * 0.55, a + w));
    });
    setVar(suivi, '--foot', easeOut(seg(p, plan.foot[0], plan.foot[1])));

    placeDock(dock, from, to);

    const off = plan.out ? seg(p, plan.out[0], plan.out[1]) > 0.5 : false;
    if (off !== ctaOff) {
      ctaOff = off;
      heroText.classList.toggle('is-cta-off', off);
      barUpdate();
    }
  };

  /* Active ou coupe la landing épinglée selon l'écran (décision initiale
     prise dans <head> pour éviter tout saut de mise en page). */
  const evaluateLanding = () => {
    if (!hero) return;
    const want = root.classList.contains('motion') && !reducedMotion.matches && hasIO
      && window.innerHeight >= 600 && window.innerWidth >= 300;
    root.classList.toggle('scrolly', want);
    if (want) {
      measure();
      if (!fits()) root.classList.remove('scrolly');
    }
    resetLanding();
    if (scrollyOn()) {
      measure();
      renderLanding();
    }
  };

  /* ---------- 9. En-tête : ombre et barre de lecture ---------- */
  let readMax = 1;
  const measureRead = () => { readMax = Math.max(1, root.scrollHeight - window.innerHeight); };
  const renderHeader = () => {
    const y = window.scrollY || root.scrollTop;
    header.classList.toggle('is-scrolled', y > 4);
    header.style.setProperty('--read', clamp(y / readMax, 0, 1).toFixed(4));
  };

  let ticking = false;
  const frame = () => {
    ticking = false;
    renderLanding();
    renderHeader();
  };
  const requestFrame = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(frame);
  };

  if (hero) evaluateLanding();
  measureRead();
  renderHeader();
  window.addEventListener('scroll', requestFrame, { passive: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      evaluateLanding();
      measureRead();
      requestFrame();
    }, 120);
  }, { passive: true });
  /* Les polices chargées peuvent changer la hauteur du texte */
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { evaluateLanding(); measureRead(); requestFrame(); });
  window.addEventListener('load', () => { measureRead(); requestFrame(); });
  /* Les questions dépliées changent la hauteur de la page */
  doc.addEventListener('toggle', () => { measureRead(); requestFrame(); }, true);

  reducedMotion.addEventListener('change', () => {
    root.classList.toggle('motion', !reducedMotion.matches);
    evaluateLanding();
    requestFrame();
  });

  /* ---------- 10. Apparitions au défilement ----------
     Chaque bloc [data-reveal] apparaît une fois, en arrivant à l'écran ;
     dans un groupe [data-stagger], les éléments se suivent de 90 ms. Les
     éléments déjà visibles au chargement ne sont jamais masqués. */
  const revealables = $$('[data-reveal], [data-animate]');
  if (hasIO && revealables.length && root.classList.contains('motion') && !reducedMotion.matches) {
    $$('[data-stagger]').forEach((group) => {
      let i = 0;
      Array.from(group.children).forEach((child) => {
        if (child.hasAttribute('data-reveal')) child.style.setProperty('--d', String(Math.min(i++, 6)));
      });
    });
    const vh = window.innerHeight;
    revealables.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.top < vh && r.bottom > 0) el.classList.add('is-in');
    });
    root.classList.add('reveal-on');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    revealables.forEach((el) => { if (!el.classList.contains('is-in')) io.observe(el); });
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }
})();

