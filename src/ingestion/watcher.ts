import { watch, type FSWatcher } from "node:fs";
import { EventEmitter } from "node:events";

export class LogWatcher extends EventEmitter {
  private watchers: FSWatcher[] = [];

  start(dirs: string[]): void {
    for (const dir of dirs) {
      try {
        const w = watch(dir, { recursive: true }, (eventType, filename) => {
          if (filename && filename.endsWith(".jsonl")) {
            this.emit("change", { eventType, filename, dir });
          }
        });
        this.watchers.push(w);
      } catch {
        // Directory may not exist yet
      }
    }
  }

  stop(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
  }
}
