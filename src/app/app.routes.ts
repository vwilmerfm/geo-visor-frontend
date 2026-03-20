import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { authGuard } from './core/guards/auth.guard';
import { GeovisorComponent } from './features/geovisor/geovisor.component';
import { guestGuard } from './core/guards/guest.guard';
import {adminGuard} from './core/guards/admin.guard';
import {AdminUsuariosComponent} from './features/admin-usuarios/admin-usuarios.component';

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
    path: 'admin-usuarios',
    component: AdminUsuariosComponent,
    canActivate: [authGuard, adminGuard]
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
