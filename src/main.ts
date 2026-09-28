import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './ui/app';

registerSW({ immediate: true });
startApp(document.getElementById('app')!);
