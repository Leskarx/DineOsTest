import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

export interface BackupResult {
  success: boolean;
  filename: string;
  sizeBytes: number;
  destination: 'local' | 's3';
  s3Key?: string;
  durationMs: number;
  error?: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly backupDir: string;
  private readonly retentionDays: number;
  private readonly s3Bucket: string;
  private readonly s3Prefix: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = config.get('BACKUP_ENABLED', 'true') !== 'false';
    this.backupDir = config.get('BACKUP_DIR', path.join(process.cwd(), 'backups'));
    this.retentionDays = parseInt(config.get('BACKUP_RETENTION_DAYS', '30'), 10);
    this.s3Bucket = config.get('BACKUP_S3_BUCKET', '');
    this.s3Prefix = config.get('BACKUP_S3_PREFIX', 'db-backups');

    // Reuse existing S3 creds or dedicated backup bucket creds
    const accessKey    = config.get('BACKUP_S3_ACCESS_KEY') || config.get('S3_ACCESS_KEY', '');
    const secretKey    = config.get('BACKUP_S3_SECRET_KEY') || config.get('S3_SECRET_KEY', '');
    const region       = config.get('BACKUP_S3_REGION') || config.get('S3_REGION', 'ap-south-1');
    const endpoint     = config.get('BACKUP_S3_ENDPOINT') || config.get('S3_ENDPOINT', '');

    if (this.s3Bucket && accessKey && secretKey) {
      this.s3Client = new S3Client({
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
      this.logger.log(`Backup destination: S3 bucket=${this.s3Bucket}`);
    } else {
      this.logger.log(`Backup destination: local → ${this.backupDir}`);
    }

    // Ensure local backup dir exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // ── Daily backup at 2:00 AM IST ──────────────────────────────────────────

  @Cron('0 2 * * *', { name: 'daily-db-backup', timeZone: 'Asia/Kolkata' })
  async runScheduledBackup(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Backups disabled via BACKUP_ENABLED=false — skipping');
      return;
    }

    const result = await this.runBackup();

    if (result.success) {
      const sizeMb = (result.sizeBytes / 1024 / 1024).toFixed(2);
      this.logger.log(
        `✅ Backup complete — ${result.filename} (${sizeMb} MB) → ${result.destination}${
          result.s3Key ? ` (${result.s3Key})` : ''
        } in ${result.durationMs}ms`,
      );
    } else {
      this.logger.error(`❌ Backup FAILED: ${result.error}`);
    }

    // Prune old local backups regardless of where we uploaded
    await this.pruneLocalBackups();

    // Prune old S3 backups if using S3
    if (this.s3Client && this.s3Bucket) {
      await this.pruneS3Backups();
    }
  }

  // ── Public method — can be called from an admin endpoint if needed ────────

  async runBackup(): Promise<BackupResult> {
    const startedAt = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const dbName = this.config.get('DB_NAME', 'dinestay');
    const filename = `${dbName}_${timestamp}.sql.gz`;
    const localPath = path.join(this.backupDir, filename);

    try {
      // 1. Run pg_dump → gzip → local file
      await this.dumpToFile(localPath);
      const sizeBytes = fs.statSync(localPath).size;

      // 2. Upload to S3 if configured
      if (this.s3Client && this.s3Bucket) {
        const s3Key = `${this.s3Prefix}/${filename}`;
        await this.uploadToS3(localPath, s3Key);

        return {
          success: true,
          filename,
          sizeBytes,
          destination: 's3',
          s3Key,
          durationMs: Date.now() - startedAt,
        };
      }

      return {
        success: true,
        filename,
        sizeBytes,
        destination: 'local',
        durationMs: Date.now() - startedAt,
      };
    } catch (err: any) {
      // Clean up partial file on failure
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return {
        success: false,
        filename,
        sizeBytes: 0,
        destination: this.s3Client ? 's3' : 'local',
        durationMs: Date.now() - startedAt,
        error: err.message,
      };
    }
  }

  // ── pg_dump → gzip → file ────────────────────────────────────────────────

  private async dumpToFile(outputPath: string): Promise<void> {
    const host     = this.config.get('DB_HOST', 'localhost');
    const port     = this.config.get('DB_PORT', '5432');
    const user     = this.config.get('DB_USER', 'dinestayadmin');
    const password = this.config.get('DB_PASSWORD', '');
    const dbName   = this.config.get('DB_NAME', 'dinestay');

    return new Promise((resolve, reject) => {
      const env = { ...process.env, PGPASSWORD: password };

      const pg = spawn('pg_dump', [
        '-h', host,
        '-p', port,
        '-U', user,
        '-Fc',           // custom format — faster restore, better compression
        '--no-password', // password comes via PGPASSWORD env
        dbName,
      ], { env });

      const gzip = zlib.createGzip({ level: 9 });
      const out  = createWriteStream(outputPath);

      pg.stdout.pipe(gzip).pipe(out);

      pg.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        // pg_dump writes warnings to stderr; only fail on real errors
        if (msg && !msg.startsWith('pg_dump: warning')) {
          this.logger.warn(`pg_dump stderr: ${msg}`);
        }
      });

      out.on('finish', resolve);
      pg.on('error', (err) => reject(new Error(`pg_dump spawn failed: ${err.message} — is pg_dump installed?`)));
      pg.on('close', (code) => {
        if (code !== 0) reject(new Error(`pg_dump exited with code ${code}`));
      });
      gzip.on('error', reject);
      out.on('error', reject);
    });
  }

  // ── S3 upload ────────────────────────────────────────────────────────────

  private async uploadToS3(localPath: string, s3Key: string): Promise<void> {
    const fileStream = createReadStream(localPath);
    const stat = fs.statSync(localPath);

    await this.s3Client!.send(new PutObjectCommand({
      Bucket:        this.s3Bucket,
      Key:           s3Key,
      Body:          fileStream,
      ContentLength: stat.size,
      ContentType:   'application/gzip',
      Metadata: {
        'created-by': 'dinestay-backup-service',
        'created-at': new Date().toISOString(),
      },
    }));
  }

  // ── Prune old local backups ───────────────────────────────────────────────

  private async pruneLocalBackups(): Promise<void> {
    try {
      const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
      const files  = fs.readdirSync(this.backupDir);

      for (const file of files) {
        if (!file.endsWith('.sql.gz')) continue;
        const filePath = path.join(this.backupDir, file);
        const mtime    = fs.statSync(filePath).mtimeMs;
        if (mtime < cutoff) {
          fs.unlinkSync(filePath);
          this.logger.log(`Pruned old backup: ${file}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to prune local backups: ${err.message}`);
    }
  }

  // ── Prune old S3 backups ─────────────────────────────────────────────────

  private async pruneS3Backups(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

      const list = await this.s3Client!.send(new ListObjectsV2Command({
        Bucket: this.s3Bucket,
        Prefix: `${this.s3Prefix}/`,
      }));

      const toDelete = (list.Contents ?? []).filter(
        (obj) => obj.LastModified && obj.LastModified < cutoff,
      );

      for (const obj of toDelete) {
        await this.s3Client!.send(new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key:    obj.Key!,
        }));
        this.logger.log(`Pruned S3 backup: ${obj.Key}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to prune S3 backups: ${err.message}`);
    }
  }

  // ── List recent backups (for admin endpoint) ──────────────────────────────

  listLocalBackups(): Array<{ filename: string; sizeBytes: number; createdAt: Date }> {
    try {
      return fs.readdirSync(this.backupDir)
        .filter((f) => f.endsWith('.sql.gz'))
        .map((f) => {
          const stat = fs.statSync(path.join(this.backupDir, f));
          return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch {
      return [];
    }
  }
}
