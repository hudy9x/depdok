type RenderJob = {
  lines: string[];
  dark: boolean;
  resolve: (svg: string) => void;
  reject: (err: Error) => void;
};

const queue: RenderJob[] = [];
let processing = false;
let plantumlModule: any = null;

async function initPlantUML() {
  if (!plantumlModule) {
    // Load viz-global and manually ensure it is bound to globalThis.Viz
    const VizModule = await import("@plantuml/core/viz-global.js");
    if (!(globalThis as any).Viz) {
      const Viz = VizModule.instance ? VizModule : (VizModule.default || VizModule);
      (globalThis as any).Viz = Viz;
    }
    plantumlModule = await import("@plantuml/core");
  }
  return plantumlModule;
}

function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  const job = queue[0];

  initPlantUML()
    .then((module) => {
      module.renderToString(
        job.lines,
        (svg: string) => {
          job.resolve(svg);
          queue.shift();
          processing = false;
          processQueue();
        },
        (err: string) => {
          job.reject(new Error(err));
          queue.shift();
          processing = false;
          processQueue();
        },
        { dark: job.dark }
      );
    })
    .catch((err) => {
      job.reject(err);
      queue.shift();
      processing = false;
      processQueue();
    });
}

export function queuePlantUMLRender(content: string, dark: boolean): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lines = content.split(/\r?\n/);
    queue.push({ lines, dark, resolve, reject });
    processQueue();
  });
}
