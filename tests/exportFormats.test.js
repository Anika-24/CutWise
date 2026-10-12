import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportBundle,
  generateCsvExport,
  generateLaserSvgExport,
  generateCncProgram,
  generateObjExport,
} from '../src/lib/exportFormats.js';

const material = {
  type: 'plywood',
  sheetWidth: 2440,
  sheetHeight: 1220,
  thickness: 18,
  sheetQuantity: 4,
  pricePerSheet: 38,
  kerf: 3,
  edgeMargin: 10,
  rotationAllowed: true,
  unit: 'mm',
};

const layout = {
  valid: true,
  status: 'complete',
  strategy: 'most_efficient',
  algorithm: 'MaxRects',
  sheets: [
    {
      index: 0,
      width: 2440,
      height: 1220,
      placements: [
        { name: 'Panel A', x: 20, y: 30, w: 300, h: 200, rotated: false },
        { name: 'Panel B', x: 360, y: 40, w: 200, h: 150, rotated: true },
      ],
    },
  ],
  unplaced: [],
  stats: { sheetsUsed: 1, utilization: 42.5, waste: 57.5, totalCost: 38 },
};

const pieces = [
  { name: 'Panel A', width: 300, height: 200, quantity: 1, rotationAllowed: true },
  { name: 'Panel B', width: 200, height: 150, quantity: 1, rotationAllowed: true },
];

test('export bundle includes machine-readable layout data', () => {
  const bundle = buildExportBundle('Demo Project', material, layout, pieces);

  assert.equal(bundle.projectName, 'Demo Project');
  assert.equal(bundle.material.sheetWidth, 2440);
  assert.equal(bundle.layout.sheets.length, 1);
  assert.equal(bundle.pieces.length, 2);
});

test('csv and laser exports are generated from the layout', () => {
  const csv = generateCsvExport('Demo Project', material, layout);
  const laser = generateLaserSvgExport('Demo Project', material, layout);

  assert.match(csv, /Project,Demo Project/);
  assert.match(csv, /Panel A,0,20,30,300,200/);
  assert.match(laser, /<svg/);
  assert.match(laser, /Panel A/);
});

test('cnc and obj exports are machine-friendly', () => {
  const cnc = generateCncProgram('Demo Project', material, layout);
  const obj = generateObjExport('Demo Project', material, layout);

  assert.match(cnc, /G21/);
  assert.match(cnc, /G1 X/);
  assert.match(obj, /v 20 30 0/);
  assert.match(obj, /f /);
});
