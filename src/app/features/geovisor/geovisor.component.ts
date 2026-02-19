import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-geovisor',
  standalone: true,
  templateUrl: './geovisor.component.html',
  styleUrl: './geovisor.component.scss'
})
export class GeovisorComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  private map!: L.Map;

  isLoading = signal(false);

  ngOnInit(): void {
    this.iniciarMapa();
  }

  private iniciarMapa(): void {
    this.map = L.map('mapa-censo').setView([-16.5, -68.15], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap 2026'
    }).addTo(this.map);
  }

  cargarDatosPrueba() {
    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
      alert('Mostrando');
    }, 2000);
  }

  cerrarSesion() {
    this.authService.logout();
  }
}
