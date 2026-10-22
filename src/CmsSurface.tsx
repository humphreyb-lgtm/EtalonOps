import {Children,createElement,isValidElement,type ReactNode,type JSX} from 'react';
import {useCms} from './CmsContext';
import {CmsNodes} from './CmsRenderer';
export function CmsSource({children}:{slot:string;title:string;editableText?:string;children?:ReactNode}){return <>{children}</>;}
export function CmsSurface<T extends keyof JSX.IntrinsicElements>({as,surfaceId,surfaceTitle,children,...props}:{as:T;surfaceId:string;surfaceTitle?:string}&JSX.IntrinsicElements[T]){
 const {documents}=useCms();const page=documents.get(surfaceId);const sources:Record<string,ReactNode>={};
 for(const child of Children.toArray(children))if(isValidElement<{slot:string;children:ReactNode}>(child)&&child.type===CmsSource)sources['source:'+child.props.slot]=child.props.children;
 if(page&&!page.enabled)return null;
 return createElement(as,{...props,...(page?.root.classes?{className:((props as Record<string,unknown>).className??'')+' '+page.root.classes}:{}),'data-cms-document':surfaceId,'data-cms-native-title':surfaceTitle,'data-cms-node':[(props as Record<string,unknown>)['data-cms-node'],page?.root.id].filter(Boolean).join(' ')},page?<CmsNodes nodes={page.root.children} sources={sources}/>:children);
}
