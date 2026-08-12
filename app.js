// Logica da aplicacao. Funcoes puras no topo (testaveis), wiring de DOM no fim.

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
const MATCH_THRESHOLD = 0.55;

// --- Funcoes puras (testadas em test/app.test.js) ---

function validarNomeCadastro(nome) {
  const limpo = (nome || '').trim();
  return limpo.length > 0 ? limpo : null;
}

function avaliarReconhecimento(descriptor, faceMatcher) {
  if (!descriptor) {
    return { ok: false, mensagem: 'Rosto não encontrado. Aproxime o celular.' };
  }
  if (!faceMatcher) {
    return { ok: false, mensagem: 'Nenhum rosto cadastrado ainda.' };
  }
  const match = faceMatcher.findBestMatch(descriptor);
  if (match.label === 'unknown') {
    return { ok: false, mensagem: 'Rosto não reconhecido. Cadastre-se primeiro.' };
  }
  return { ok: true, nome: match.label };
}

function montarMensagemPonto(tipo, nome, dataHoraISO) {
  const hora = new Date(dataHoraISO).toLocaleTimeString('pt-BR');
  return tipo + ' registrada: ' + nome + ' às ' + hora;
}

function montarFaceMatcher(cadastros, threshold) {
  if (!cadastros || cadastros.length === 0) return null;
  const labeled = cadastros.map(c => new faceapi.LabeledFaceDescriptors(
    c.nome, [new Float32Array(c.descriptor)]
  ));
  return new faceapi.FaceMatcher(labeled, threshold || MATCH_THRESHOLD);
}

// --- Wiring de DOM (roda so no navegador) ---

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  (function () {
    let cadastros = [];
    let faceMatcher = null;

    function setStatus(el, msg, tipo) {
      el.textContent = msg;
      el.className = 'status ' + (tipo || '');
    }

    async function startCamera(videoEl, stream) {
      videoEl.srcObject = stream;
      return new Promise(resolve => videoEl.onloadedmetadata = () => resolve());
    }

    async function getSharedStream() {
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 } },
        audio: false
      });
    }

    async function loadModels() {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    }

    async function detectDescriptor(videoEl) {
      const result = await faceapi
        .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      return result ? result.descriptor : null;
    }

    async function fetchCadastros() {
      const res = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      cadastros = data.cadastros || [];
      faceMatcher = montarFaceMatcher(cadastros, MATCH_THRESHOLD);
    }

    async function postAppsScript(body) {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body)
      });
      return res.json();
    }

    // --- Tabs ---
    const tabPonto = document.getElementById('tabPonto');
    const tabCadastro = document.getElementById('tabCadastro');
    const secPonto = document.getElementById('secPonto');
    const secCadastro = document.getElementById('secCadastro');

    tabPonto.onclick = () => {
      tabPonto.classList.add('active');
      tabCadastro.classList.remove('active');
      secPonto.classList.add('active');
      secCadastro.classList.remove('active');
      fetchCadastros();
    };
    tabCadastro.onclick = () => {
      tabCadastro.classList.add('active');
      tabPonto.classList.remove('active');
      secCadastro.classList.add('active');
      secPonto.classList.remove('active');
    };

    // --- Ponto ---
    const videoPonto = document.getElementById('videoPonto');
    const btnPonto = document.getElementById('btnPonto');
    const statusPonto = document.getElementById('statusPonto');

    btnPonto.onclick = async () => {
      btnPonto.disabled = true;
      setStatus(statusPonto, 'Analisando rosto...', 'info');
      try {
        const descriptor = await detectDescriptor(videoPonto);
        const avaliacao = avaliarReconhecimento(descriptor, faceMatcher);
        if (!avaliacao.ok) {
          setStatus(statusPonto, avaliacao.mensagem, 'erro');
          return;
        }
        setStatus(statusPonto, 'Registrando ' + avaliacao.nome + '...', 'info');
        const resp = await postAppsScript({ action: 'registrar', nome: avaliacao.nome });
        setStatus(statusPonto, montarMensagemPonto(resp.tipo, avaliacao.nome, resp.dataHora), 'ok');
      } catch (err) {
        setStatus(statusPonto, 'Erro: ' + err.message, 'erro');
      } finally {
        btnPonto.disabled = false;
      }
    };

    // --- Cadastro ---
    const videoCadastro = document.getElementById('videoCadastro');
    const btnCadastro = document.getElementById('btnCadastro');
    const statusCadastro = document.getElementById('statusCadastro');
    const inputNome = document.getElementById('inputNome');

    btnCadastro.onclick = async () => {
      const nome = validarNomeCadastro(inputNome.value);
      if (!nome) {
        setStatus(statusCadastro, 'Digite o nome primeiro.', 'erro');
        return;
      }
      btnCadastro.disabled = true;
      setStatus(statusCadastro, 'Capturando rosto...', 'info');
      try {
        const descriptor = await detectDescriptor(videoCadastro);
        if (!descriptor) {
          setStatus(statusCadastro, 'Rosto não encontrado. Aproxime o celular.', 'erro');
          return;
        }
        await postAppsScript({ action: 'cadastrar', nome: nome, descriptor: Array.from(descriptor) });
        setStatus(statusCadastro, 'Cadastrado: ' + nome, 'ok');
        inputNome.value = '';
        await fetchCadastros();
      } catch (err) {
        setStatus(statusCadastro, 'Erro: ' + err.message, 'erro');
      } finally {
        btnCadastro.disabled = false;
      }
    };

    // --- Init ---
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    (async function init() {
      try {
        loadingText.textContent = 'Carregando modelos de reconhecimento...';
        await loadModels();
        loadingText.textContent = 'Ligando câmera...';
        const stream = await getSharedStream();
        await Promise.all([startCamera(videoPonto, stream), startCamera(videoCadastro, stream)]);
        await fetchCadastros();
        loadingOverlay.classList.add('hidden');
        setStatus(statusPonto, 'Pronto. Aponte o rosto e toque em Reconhecer.', 'info');
      } catch (err) {
        loadingText.textContent = 'Erro ao iniciar: ' + err.message;
      }
    })();
  })();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validarNomeCadastro,
    avaliarReconhecimento,
    montarMensagemPonto,
    montarFaceMatcher
  };
}
