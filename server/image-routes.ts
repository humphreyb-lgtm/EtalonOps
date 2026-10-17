import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Repository } from './repository';
import { ApiError, type Principal } from './contracts';
import { imageEvidence, imageDecision } from './image-contracts';
import { normalizeImage, imageKey, type ImageAssets } from './image-assets';

export function imageRoutes(app: express.Express,store: Repository,assets?: ImageAssets) {
  const param=(req:express.Request,name:string)=>z.string().parse(req.params[name]);
  const principal=(res:express.Response):Principal=>res.locals.principal;
  const storage=()=>{if(!assets)throw new ApiError(503,'Image storage is not configured.');return assets;};
  const admin:express.RequestHandler=async(_req,res,next)=>{try{await store.requireAdmin(principal(res));next();}catch(error){next(error);}};
  const uploadLimit=rateLimit({windowMs:60_000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:(_req,res)=>`${principal(res).tenant}/${principal(res).oid}`});
  let uploads=0;
  const slots:express.RequestHandler=(_req,res,next)=>{
    if(uploads>=2){next(new ApiError(429,'Two image uploads are already processing. Try again shortly.'));return;}
    uploads++;let released=false;const release=()=>{if(!released){released=true;uploads--;}};
    res.once('close',release);res.once('finish',release);next();
  };
  app.get('/api/admin/materials/:id/images',admin,async(req,res)=>res.json({images:await store.listImages(principal(res),param(req,'id'))}));
  app.post('/api/admin/materials/:id/images',admin,uploadLimit,slots,express.raw({type:['image/jpeg','image/png','image/webp','application/octet-stream'],limit:'5mb'}),async(req,res)=>{
    const p=principal(res);await store.imageMaterial(p,param(req,'id'),true);
    if(!Buffer.isBuffer(req.body))throw new ApiError(400,'Upload a JPEG, PNG or WebP file.');
    let evidence: z.infer<typeof imageEvidence>;
    try{evidence=imageEvidence.parse({sourceUrl:decodeURIComponent(req.get('x-image-source-url')??''),rightsBasis:decodeURIComponent(req.get('x-image-rights-basis')??'')});}
    catch(error){if(error instanceof URIError)throw new ApiError(400,'Invalid image evidence headers.');throw error;}
    const image=await normalizeImage(req.body);
    const prior=(await store.listImages(p,param(req,'id'))).find(record=>record.contentHash===image.hash);
    if(prior?.status==='rejected')throw new ApiError(409,'This image was rejected for this product; choose a different image.');
    const association=await store.submitImage(p,param(req,'id'),image.hash,evidence);
    await storage().put(imageKey(p.tenant,param(req,'id'),image.hash),image.bytes);
    res.status(201).json({image:association});
  });
  app.post('/api/admin/materials/:id/images/:imageId/review',admin,async(req,res)=>{
    const body=imageDecision.parse(req.body);
    if(body.status==='approved'){
      const p=principal(res),record=(await store.listImages(p,param(req,'id'))).find(image=>image.id===param(req,'imageId'));
      if(!record)throw new ApiError(404,'Image association not found.');
      try{await storage().get(imageKey(p.tenant,param(req,'id'),record.contentHash));}catch{throw new ApiError(409,'Image content is unavailable. Retry the image upload before approving it.');}
    }
    res.json({image:await store.reviewImage(principal(res),param(req,'id'),param(req,'imageId'),body.status)});
  });
  app.get('/api/admin/materials/:id/images/:imageId/content',admin,async(req,res)=>{
    const p=principal(res);const image=(await store.listImages(p,param(req,'id'))).find(image=>image.id===param(req,'imageId'));
    if(!image)throw new ApiError(404,'Image not found.');
    res.set('Cache-Control','private, no-store').type('image/webp').send(await storage().get(imageKey(p.tenant,param(req,'id'),image.contentHash)));
  });
  app.get('/api/materials/:id/image',async(req,res)=>{
    const p=principal(res);const image=await store.approvedImage(p,param(req,'id'));
    if(!image)throw new ApiError(404,'No approved image.');
    res.set('Cache-Control','private, no-store').type('image/webp').send(await storage().get(imageKey(p.tenant,param(req,'id'),image.contentHash)));
  });
}
