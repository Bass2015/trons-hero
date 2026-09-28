import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './ui/app';

registerSW({ immediate: true });
startApp(document.getElementById('app')!);
