import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    const userStr = localStorage.getItem('user');

    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role && user.role.toLowerCase().includes('admin')) {
        router.navigate(['/admin-usuarios']);
        return false;
      }
    }

    router.navigate(['/mapa']);
    return false;
  }

  return true;
};
