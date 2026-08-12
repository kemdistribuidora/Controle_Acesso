const test = require('node:test');
const assert = require('node:assert/strict');
const { validarNomeCadastro, avaliarReconhecimento, montarMensagemPonto } = require('../app.js');

test('validarNomeCadastro rejeita vazio', () => {
  assert.equal(validarNomeCadastro(''), null);
  assert.equal(validarNomeCadastro('   '), null);
  assert.equal(validarNomeCadastro(undefined), null);
});

test('validarNomeCadastro aceita e limpa espacos', () => {
  assert.equal(validarNomeCadastro('  João Silva  '), 'João Silva');
});

test('avaliarReconhecimento falha sem descritor (rosto nao encontrado)', () => {
  const r = avaliarReconhecimento(null, {});
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /não encontrado/);
});

test('avaliarReconhecimento falha sem cadastros', () => {
  const r = avaliarReconhecimento([1, 2, 3], null);
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /Nenhum rosto cadastrado/);
});

test('avaliarReconhecimento falha quando rosto desconhecido', () => {
  const faceMatcher = { findBestMatch: () => ({ label: 'unknown' }) };
  const r = avaliarReconhecimento([1, 2, 3], faceMatcher);
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /não reconhecido/);
});

test('avaliarReconhecimento retorna nome quando reconhecido', () => {
  const faceMatcher = { findBestMatch: () => ({ label: 'Maria' }) };
  const r = avaliarReconhecimento([1, 2, 3], faceMatcher);
  assert.equal(r.ok, true);
  assert.equal(r.nome, 'Maria');
});

test('montarMensagemPonto inclui tipo e nome', () => {
  const msg = montarMensagemPonto('Entrada', 'Maria', new Date().toISOString());
  assert.match(msg, /^Entrada registrada: Maria às /);
});
