import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { authGuard } from './core/guards/auth.guard';
import { GeovisorComponent } from './features/geovisor/geovisor.component';
import { guestGuard } from './core/guards/guest.guard';
import {GeoEjemploComponent} from './features/geo-ejemplo/geo-ejemplo.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'mapa',
    component: GeovisorComponent,
    canActivate: [authGuard]
  },
  {
    path: 'geo-ejemplo',
    component: GeoEjemploComponent,
    canActivate: [authGuard]
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
