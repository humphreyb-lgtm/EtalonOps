import DOMPurify from 'dompurify';
export const safeCmsHtml=(html:string)=>DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','br','strong','b','em','i','u','s','ul','ol','li','a','span','h1','h2','h3','h4','blockquote','code','pre'],ALLOWED_ATTR:['href','title','target','rel'],ALLOW_DATA_ATTR:false});
