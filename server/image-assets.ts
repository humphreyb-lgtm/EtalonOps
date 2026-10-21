import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { ContainerClient } from '@azure/storage-blob';
import { ManagedIdentityCredential } from '@azure/identity';
import { ApiError } from './contracts';

export interface ImageAssets { put(key: string, bytes: Buffer): Promise<void>; get(key: string): Promise<Buffer>; }
export const imageHash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export function imageKey(tenant: string, material: string, hash: string) {
  if (!/^[\da-f-]{36}$/i.test(material) || !/^[\da-f]{64}$/.test(hash)) throw new Error('Invalid image storage identifier.');
  return `${imageHash(Buffer.from(tenant))}/${material.toLowerCase()}/${hash}.webp`;
}
function safeKey(key: string) {
  if (!/^[\da-f]{64}\/[\da-f-]{36}\/[\da-f]{64}\.webp$/.test(key)) throw new Error('Invalid image key.');
  return key;
}
export async function normalizeImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > 5*1024*1024) throw new ApiError(400,'Upload one image of at most 5 MB.');
  try {
    const decoder = sharp(bytes,{limitInputPixels:16_000_000,failOn:'warning'});
    const metadata = await decoder.metadata();
    if (!['jpeg','png','webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) throw new Error('Unsupported image');
    const normalized = await decoder.rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
    if (normalized.length > 2*1024*1024) throw new Error('Normalized image too large');
    return { bytes:normalized, hash:imageHash(normalized) };
  } catch { throw new ApiError(400,'Use a valid, single-frame JPEG, PNG or WebP image up to 16 megapixels. SVG, animation and corrupt files are not accepted.'); }
}
export class FileImageAssets implements ImageAssets {
  constructor(private root: string) {}
  async put(key: string, bytes: Buffer) {
    const path=join(this.root,safeKey(key));await mkdir(join(path,'..'),{recursive:true,mode:0o700});
    try { await writeFile(path,bytes,{flag:'wx',mode:0o600}); }
    catch(error) { if (!(error && typeof error==='object' && 'code' in error && error.code==='EEXIST')) throw error; if (imageHash(await readFile(path))!==imageHash(bytes)) throw new Error('Existing image content mismatch.'); }
  }
  async get(key: string) {
    const path=join(this.root,safeKey(key));
    if ((await stat(path)).size>2*1024*1024) throw new Error('Stored image exceeds limit.');
    const bytes=await readFile(path);
    if (!key.endsWith(`${imageHash(bytes)}.webp`)) throw new Error('Stored image checksum mismatch.');
    return bytes;
  }
}
export class BlobImageAssets implements ImageAssets {
  private container: ContainerClient;
  constructor(account: string,credential:Pick<ManagedIdentityCredential,'getToken'> = new ManagedIdentityCredential()) {
    if (!/^[a-z0-9]{3,24}$/.test(account)) throw new Error('Explicit Azure storage account is required.');
    this.container=new ContainerClient(`https://${account}.blob.core.windows.net/catalog-images`,credential);
  }
  async put(key: string,bytes: Buffer) {
    const blob=this.container.getBlockBlobClient(safeKey(key));
    try { await blob.uploadData(bytes,{conditions:{ifNoneMatch:'*'},blobHTTPHeaders:{blobContentType:'image/webp'},metadata:{sha256:imageHash(bytes)}}); }
    catch(error) {
      if (!(error && typeof error==='object' && 'statusCode' in error && [409,412].includes(Number(error.statusCode)))) throw error;
      if (imageHash(await this.get(key))!==imageHash(bytes)) throw new Error('Existing blob checksum mismatch.');
    }
  }
  async get(key: string) {
    const blob=this.container.getBlockBlobClient(safeKey(key));
    const properties=await blob.getProperties();
    if (!properties.contentLength || properties.contentLength>2*1024*1024) throw new Error('Stored image exceeds limit.');
    const bytes=await blob.downloadToBuffer();
    if (!key.endsWith(`${imageHash(bytes)}.webp`)) throw new Error('Stored blob checksum mismatch.');
    return bytes;
  }
}
