const test = require('node:test');
const assert = require('node:assert/strict');
const { proximoTipo_ } = require('../Code.gs');

test('proximoTipo_ sem registro anterior comeca com Entrada', () => {
  assert.equal(proximoTipo_(null), 'Entrada');
});

test('proximoTipo_ alterna de Entrada para Saida', () => {
  assert.equal(proximoTipo_('Entrada'), 'Saida');
});

test('proximoTipo_ alterna de Saida para Entrada', () => {
  assert.equal(proximoTipo_('Saida'), 'Entrada');
});
