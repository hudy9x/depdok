import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DraftDB extends DBSchema {
  drafts: {
    key: string;
    value: {
      filePath: string;
      content: string;
      timestamp: number;
    };
  };
}

class DraftService {
  private db: IDBPDatabase<DraftDB> | null = null;

  async init() {
    this.db = await openDB<DraftDB>('depdok-drafts', 1, {
      upgrade(db) {
        db.createObjectStore('drafts', { keyPath: 'filePath' });
      },
    });
  }

  async saveDraft(filePath: string, content: string) {
    if (!this.db) await this.init();
    await this.db!.put('drafts', {
      filePath,
      content,
      timestamp: Date.now(),
    });
  }

  async getDraft(filePath: string) {
    if (!this.db) await this.init();
    return await this.db!.get('drafts', filePath);
  }

  // Option A: Remove only on successful save
  async removeDraft(filePath: string) {
    if (!this.db) await this.init();
    await this.db!.delete('drafts', filePath);
  }

  // Rename draft when file is renamed
  async renameDraft(oldPath: string, newPath: string) {
    if (!this.db) await this.init();
    const draft = await this.getDraft(oldPath);
    if (draft) {
      await this.saveDraft(newPath, draft.content);
      await this.removeDraft(oldPath);
    }
  }
}

export const draftService = new DraftService();
