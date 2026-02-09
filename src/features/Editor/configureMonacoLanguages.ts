import type { Monaco } from '@monaco-editor/react';

/**
 * Configure Monaco Editor language settings
 * Disables diagnostics for TypeScript, JavaScript, and CSS
 */
export function configureMonacoLanguages(monaco: Monaco) {
  // Disable TypeScript/JavaScript diagnostics (no error highlighting)
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  // Configure compiler options for TypeScript
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: 'React',
    allowJs: true,
    typeRoots: ['node_modules/@types'],
  });

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: 'React',
    allowJs: true,
  });

  // Disable CSS diagnostics
  monaco.languages.css.cssDefaults.setDiagnosticsOptions({
    validate: false,
  });

  monaco.languages.css.scssDefaults.setDiagnosticsOptions({
    validate: false,
  });

  monaco.languages.css.lessDefaults.setDiagnosticsOptions({
    validate: false,
  });
}
