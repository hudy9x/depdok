if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    __TAURI_INTERNALS__: {
      invoke: async (cmd: string) => {
        if (cmd === 'read_binary_file') return [];
        return null;
      },
    },
  };
}

import { SpreadsheetSDK } from '../spreadsheetSdk';

async function runTest() {
  const { sheetFormatRangeTool } = await import('@/features/LLMChat2/tools/spreadsheet/sheetFormatRange');
  const { sheetEditCellTool } = await import('@/features/LLMChat2/tools/spreadsheet/sheetEditCell');
  const { getDefaultStore } = await import('jotai');
  const { liveFilesContentAtom } = await import('@/stores/EditorStore');

  console.log('=== Test 1: Core ExcelJS Style Persistence ===');

  // 1. Create a workbook
  let wb = SpreadsheetSDK.createWorkbook('Report');

  // 2. Set value & styles on A1 (Background fill and font color)
  wb = SpreadsheetSDK.executeCommand(wb, {
    type: 'SET_CELL_VALUE',
    sheet: 'Report',
    cell: 'A1',
    value: 'Revenue Summary',
  }).workbook;

  wb = SpreadsheetSDK.executeCommand(wb, {
    type: 'SET_CELL_STYLE',
    sheet: 'Report',
    range: 'A1',
    style: {
      bold: true,
      fontSize: 14,
      bgColor: '#FFFFC000',
      color: '#FF1E293B',
      align: 'center',
    },
  }).workbook;

  // 3. Set borders on B2
  wb = SpreadsheetSDK.executeCommand(wb, {
    type: 'SET_CELL_VALUE',
    sheet: 'Report',
    cell: 'B2',
    value: 50000,
  }).workbook;

  wb = SpreadsheetSDK.executeCommand(wb, {
    type: 'APPLY_BORDER',
    sheet: 'Report',
    range: 'B2',
    borderType: 'all',
    color: '#FFEF4444',
    style: 'thick',
  }).workbook;

  // 4. Set formula on B3
  wb = SpreadsheetSDK.executeCommand(wb, {
    type: 'SET_CELL_FORMULA',
    sheet: 'Report',
    cell: 'B3',
    formula: 'B2*1.2',
  }).workbook;

  // 5. Serialize to binary XLSX bytes
  const bytes = await SpreadsheetSDK.toBinary(wb);
  console.log(`Exported XLSX size: ${bytes.byteLength} bytes`);

  // 6. Parse back from binary XLSX bytes (simulating close and reopen)
  const reloadedWb = await SpreadsheetSDK.loadWorkbook(bytes);

  const a1After = reloadedWb.sheets['Report'].cells['A1'];
  const b2After = reloadedWb.sheets['Report'].cells['B2'];
  const b3After = reloadedWb.sheets['Report'].cells['B3'];

  console.log('A1 After reload:', JSON.stringify(a1After));
  console.log('B2 After reload:', JSON.stringify(b2After));
  console.log('B3 After reload:', JSON.stringify(b3After));

  let passed = true;

  // Assert A1 background and bold
  if (!a1After || !a1After.s || !a1After.s.bgColor) {
    console.error('FAIL: A1 bgColor is missing!');
    passed = false;
  } else {
    console.log(`PASS: A1 bgColor preserved: ${a1After.s.bgColor}`);
  }

  // Assert B2 borders
  if (!b2After || !b2After.s || !b2After.s.border || !b2After.s.border.top) {
    console.error('FAIL: B2 borders are missing!');
    passed = false;
  } else {
    console.log(`PASS: B2 borders preserved:`, b2After.s.border);
  }

  // Assert B3 formula
  if (!b3After || b3After.f !== 'B2*1.2') {
    console.error(`FAIL: B3 formula mismatch: expected 'B2*1.2', got '${b3After?.f}'`);
    passed = false;
  } else {
    console.log(`PASS: B3 formula preserved: ${b3After.f}`);
  }

  console.log('\n=== Test 2: AI Sheet Tools (sheet_edit_cell, sheet_format_range) ===');

  // Seed Jotai store with in-memory workbook for tool execution
  const testPath = '/test/demo.xlsx';
  const initialBase64 = await SpreadsheetSDK.toBase64(reloadedWb);
  const store = getDefaultStore();
  store.set(liveFilesContentAtom, { [testPath]: initialBase64 });

  // 1. Edit cell value
  await sheetEditCellTool({
    path: testPath,
    sheet: 'Report',
    cell: 'C1',
    value: 'Category',
  });

  // 2. Format range with background and outer border
  await sheetFormatRangeTool({
    path: testPath,
    sheet: 'Report',
    range: 'C1:D5',
    bg_color: '#3B82F6',
    border: {
      borderType: 'outer',
      color: '#1E293B',
      style: 'medium',
    },
  });

  // Verify updated workbook
  const updatedBase64 = store.get(liveFilesContentAtom)[testPath];
  const toolResultWb = await SpreadsheetSDK.loadWorkbook(updatedBase64);

  const c1 = toolResultWb.sheets['Report'].cells['C1'];
  const d1 = toolResultWb.sheets['Report'].cells['D1'];
  const d5 = toolResultWb.sheets['Report'].cells['D5'];

  console.log('C1 formatted by tool:', JSON.stringify(c1));
  console.log('D1 formatted by tool:', JSON.stringify(d1));
  console.log('D5 formatted by tool:', JSON.stringify(d5));

  if (c1?.v !== 'Category' || c1?.s?.bgColor !== '#3B82F6') {
    console.error('FAIL: C1 edit & style check failed!', c1);
    passed = false;
  } else {
    console.log('PASS: C1 value updated via sheet_edit_cell and formatted via sheet_format_range!');
  }

  if (d1?.s?.bgColor !== '#3B82F6' || !d1?.s?.border?.top || !d1?.s?.border?.right) {
    console.error('FAIL: D1 range format failed!', d1);
    passed = false;
  } else {
    console.log('PASS: D1 range format (bg_color + outer border) correctly applied via sheet_format_range!');
  }

  if (passed) {
    console.log('\n ALL TESTS PASSED SUCCESSFULLY! Clean, simple border and background implementation verified.');
  } else {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
