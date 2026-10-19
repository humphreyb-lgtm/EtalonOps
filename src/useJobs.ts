import {useEffect,useState} from 'react';
import {databaseMode,request} from './api';
import {projects} from './domain';
export function useJobs(all=false){const [jobs,setJobs]=useState<{id:string;name:string;number:string}[]>(databaseMode?[]:projects);useEffect(()=>{if(!databaseMode)return;let cancelled=false;const load=()=>{void (all?request<{jobs:{id:string;name:string;number:string}[]}>('/admin/users/directory','POST',{}).then(v=>v.jobs):request<{records:{id:string;name:string;number:string}[]}>('/jobs').then(v=>v.records)).then(v=>{if(!cancelled)setJobs(v);}).catch(()=>{});};load();window.addEventListener('etalonops-jobs-changed',load);return()=>{cancelled=true;window.removeEventListener('etalonops-jobs-changed',load);};},[all]);return jobs;}
