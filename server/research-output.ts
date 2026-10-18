import {separateResearchDetails} from '../src/research-attributes';
import {z} from 'zod';
import {researchFields,researchCandidate} from '../src/catalog-research';
import {normalize} from './search';
import {materialInput,describeMaterial} from './catalog-v2';
import {publicSourceUrl,type ResearchSource} from './research-source';
import {researchPolicy} from './research-policy';
export const researchNumericFields=['diameterIn','lengthIn','minSpanIn','maxSpanIn','widthIn','heightIn','depthIn'] as const;
export const researchTextFields=['material','type','schedule','endConnection','mounting','nominalSpacing','knockouts','specification'] as const;
const string={type:'string'},number={type:'number'};
const attributeProperties=Object.fromEntries([...researchNumericFields.map(name=>[name,{type:['number','null']}]),...researchTextFields.map(name=>[name,{type:['string','null']}])]);
export const researchOutputSchema={type:'object',additionalProperties:false,required:['coverageNotes','items'],properties:{coverageNotes:string,items:{type:'array',items:{type:'object',additionalProperties:false,required:['externalKey','category','productUnit','attributes','additionalDefiningAttributes','manufacturer','partNumber','title','sourceIndex','verificationBasis','phrases','imageIndex'],properties:{externalKey:string,category:{type:'string',enum:['conduit','bracket','box','general']},productUnit:{type:'string',enum:['EA','FT','STICK','BOX','ROLL','PAIR']},attributes:{type:'object',additionalProperties:false,required:Object.keys(attributeProperties),properties:attributeProperties},additionalDefiningAttributes:{type:'array',items:{type:'object',additionalProperties:false,required:['name','value'],properties:{name:string,value:{anyOf:[string,number]}}}},manufacturer:string,partNumber:string,title:string,sourceIndex:{type:'integer'},verificationBasis:string,phrases:{type:'array',items:string},imageIndex:{type:['integer','null']}}}}}};
const attributeShape=Object.fromEntries([...researchNumericFields.map(name=>[name,z.number().nullable()]),...researchTextFields.map(name=>[name,z.string().nullable()])]);
const wire=z.object({coverageNotes:z.string().min(1).max(4000),items:z.array(z.object({externalKey:z.string(),category:z.enum(['conduit','bracket','box','general']),productUnit:z.enum(['EA','FT','STICK','BOX','ROLL','PAIR']),attributes:z.object(attributeShape).strict(),additionalDefiningAttributes:z.array(z.object({name:z.string(),value:z.union([z.string(),z.number()])}).strict()).max(25),manufacturer:z.string(),partNumber:z.string(),title:z.string(),sourceIndex:z.number().int().nonnegative(),verificationBasis:z.string(),phrases:z.array(z.string()).max(40),imageIndex:z.number().int().nonnegative().nullable()}).strict()).max(researchPolicy.maxItems)}).strict();
export function decodeResearchOutput(raw:unknown,scope:string,sources:ResearchSource[]){
 const parsed=wire.parse(raw);let coverageNotes=parsed.coverageNotes;
 const items=parsed.items.map((item,index)=>{
  const source=sources[item.sourceIndex];if(!source)throw Error(`Candidate ${index+1}: sourceIndex does not identify a retrieved source.`);
  const attributes:Record<string,string|number>=Object.fromEntries(Object.entries(item.attributes).filter(([,value])=>value!==null)) as Record<string,string|number>;for(const attribute of item.additionalDefiningAttributes){if(Object.hasOwn(attributes,attribute.name))throw Error(`Candidate ${index+1}: repeated attribute ${attribute.name}.`);attributes[attribute.name]=attribute.value;}
  const {sourceIndex:_source,imageIndex,attributes:_attributes,additionalDefiningAttributes:_extra,...fields}=item;
  const candidate=separateResearchDetails(researchCandidate.parse({...fields,attributes,sourceUrl:source.url}));
  const unique=new Map<string,string>();for(const phrase of [...candidate.phrases,`${candidate.manufacturer} ${candidate.partNumber}`,candidate.partNumber]){const key=normalize(phrase);if(!unique.has(key))unique.set(key,phrase);}candidate.phrases=[...unique.values()].slice(0,40);
  const missingFields=researchGaps(candidate);
  let imageUrl:string|undefined;
  if(imageIndex!==null){const observed=source.imageUrls[imageIndex];if(observed){try{if(publicSourceUrl(observed).origin===new URL(source.url).origin)imageUrl=observed;}catch{ /* Invalid optional image cannot invalidate a complete product. */ }}if(!imageUrl)coverageNotes+=' A missing or external-host image was omitted; product specifications were retained.';}
  return {...candidate,missingFields,...(imageUrl?{imageUrl}:{})};
 });
 return {scope,coverageNotes:coverageNotes.slice(0,4000),items};
}

export function researchGaps(candidate:import('../src/catalog-research').ResearchCandidate):string[]{
 const missing=researchFields[candidate.category].filter(field=>candidate.attributes[field]===undefined||candidate.attributes[field]==='');
 if(missing.length)return missing;
 try{describeMaterial(materialInput.parse({externalKey:candidate.externalKey,category:candidate.category,productUnit:candidate.productUnit,attributes:candidate.attributes,sourceUrl:candidate.sourceUrl,verificationBasis:candidate.verificationBasis,verification:'provisional',origin:'ai_discovery'}));return [];}catch(error){return [error instanceof Error?error.message.slice(0,300):'Invalid defining specifications'];}
}
