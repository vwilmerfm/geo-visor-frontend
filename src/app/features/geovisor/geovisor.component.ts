import { Component, OnInit, inject, signal } from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import * as L from 'leaflet';
import { GeovisorService } from '../../core/services/geovisor.service';
import { AuthService } from '../../core/services/auth.service';
import { NgOptimizedImage, DecimalPipe } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-geovisor',
  standalone: true,
  imports: [FormsModule, NgOptimizedImage, ReactiveFormsModule, NgSelectModule, DecimalPipe],
  templateUrl: './geovisor.component.html',
  styleUrl: './geovisor.component.scss'
})
export class GeovisorComponent implements OnInit {
  private geoService = inject(GeovisorService);
  private map!: L.Map;

  private capaDepartamentos: L.GeoJSON | null = null;
  private capaMunicipios: L.GeoJSON | null = null;
  private capaComunidades: L.GeoJSON | null = null;
  private capaApa: L.GeoJSON | null = null;

  isLoading = signal(false);
  isSidebarOpen = signal(false);
  isDownloading = signal(false);

  departamentos = signal<any[]>([]);
  municipios = signal<any[]>([]);
  comunidades = signal<any[]>([]);

  departamentoSeleccionado = signal<any>(null);
  municipioSeleccionado = signal<any>(null);
  comunidadSeleccionada = signal<any>(null);

  private authService = inject(AuthService);
  currentUser = signal<{username: string, role: string} | null>(null);

  datosPanel = signal<any>(null);

  ngOnInit(): void {
    this.iniciarMapa();
    this.cargarListaDepartamentos();
    this.cargarUsuario();
  }

  // private iniciarMapa(): void {
  //   setTimeout(() => {
  //     this.map = L.map('mapa-visor-censo').setView([-16.5, -68.15], 6);
  //
  //     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  //       maxZoom: 18,
  //       attribution: '© OpenStreetMap - INE'
  //     }).addTo(this.map);
  //
  //     this.map.invalidateSize();
  //   }, 0);
  // }

  private iniciarMapa(): void {
    setTimeout(() => {
      const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap INE'
      });

      const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '© Satelital INE'
      });

      this.map = L.map('mapa-visor-censo', {
        center: [-16.5, -64.15],
        zoom: 5,
        layers: [calles]
      });

      const baseMaps = {
        "Mapa de Calles": calles,
        "Vista Satelital": satelite
      };
      L.control.layers(baseMaps).addTo(this.map);

      this.map.invalidateSize();
    }, 0);
  }

  private cargarListaDepartamentos(): void {
    this.geoService.getDepartamentos().subscribe({
      next: (data) => {
        const deptos = data.features.map((f: any) => ({
          id: f.properties.id,
          nombre: f.properties.nombre
        })).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));

        this.departamentos.set(deptos);
        this.dibujarDepartamentos(data);
      }
    });
  }

  onDepartamentoChange(): void {
    const id = this.departamentoSeleccionado();
    this.limpiarCapas();
    this.municipios.set([]);
    this.municipioSeleccionado.set('');

    if (!id) {
      this.datosPanel.set(null);
      return;
    }

    const deptoObj = this.departamentos().find(d => d.id === +id);

    this.isLoading.set(true);
    this.geoService.getMunicipios(+id).subscribe({
      next: (geoJsonData) => {
        this.isLoading.set(false);
        const munis = geoJsonData.features.map((f: any) => f.properties)
          .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
        this.municipios.set(munis);
        this.dibujarMunicipios(geoJsonData);

        this.cargarEstadisticas('departamental', +id, { departamento: deptoObj.nombre });
      }
    });
  }

  onMunicipioChange(): void {
    const id = this.municipioSeleccionado();
    if (!id) return;

    if (this.capaApa) this.map.removeLayer(this.capaApa);

    const deptoObj = this.departamentos().find(d => d.id === +this.departamentoSeleccionado());
    const muniObj = this.municipios().find(m => m.id === +id);

    this.isLoading.set(true);
    this.geoService.getComunidades(+id).subscribe({
      next: (geoJsonData) => {
        this.isLoading.set(false);
        const comus = geoJsonData.features.map((f: any) => f.properties)
          .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));

        this.comunidades.set(comus);
        this.dibujarComunidades(geoJsonData);

        this.cargarEstadisticas('municipal', +id, {
          departamento: deptoObj.nombre,
          municipio: muniObj.nombre
        });
      }
    });
  }

  onComunidadChange(): void {
    const id = this.comunidadSeleccionada();
    if (!id || !this.capaComunidades) return;

    const deptoObj = this.departamentos().find(d => d.id === +this.departamentoSeleccionado());
    const muniObj = this.municipios().find(m => m.id === +this.municipioSeleccionado());
    const comuObj = this.comunidades().find(c => c.id === +id);

    this.cargarEstadisticas('comunidad', +id, {
      departamento: deptoObj?.nombre,
      municipio: muniObj?.nombre,
      comunidad: comuObj?.nombre
    });

    this.capaComunidades.eachLayer((layer: any) => {

      if (layer.feature.properties.id === +id) {

        if (layer.getBounds) {
          this.map.flyToBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 15 });
        } else if (layer.getLatLng) {
          this.map.flyTo(layer.getLatLng(), 15);
        }

        layer.openPopup();

        if (layer.setStyle) {
          layer.setStyle({
            radius: 9,
            color: '#b71c1c',
            fillColor: '#FFD600',
            weight: 3,
            fillOpacity: 1
          });
        }

        if (window.innerWidth <= 820) {
          this.isSidebarOpen.set(false);
        }

      } else {
        if (layer.setStyle) {
          layer.setStyle({
            radius: 5,
            color: '#999999',
            fillColor: '#ffffff',
            weight: 1,
            fillOpacity: 0.3
          });
        }
      }
    });

    if (this.capaApa) this.map.removeLayer(this.capaApa);

    this.geoService.getApaComunidad(+id).subscribe({
      next: (geoJsonData) => {
        this.capaApa = L.geoJSON(geoJsonData, {
          style: {
            color: '#8c5b55',
            weight: 2,
            fillColor: '#8c5b55',
            fillOpacity: 0.25
          }
        }).addTo(this.map);

        if (geoJsonData.features?.length > 0) {
          this.map.flyToBounds(this.capaApa.getBounds(), { padding: [40, 40], maxZoom: 15 });
        }

        this.capaApa.bringToBack();
      },
      error: (err) => console.error('Error cargando el polígono APA:', err)
    });
  }

  private dibujarDepartamentos(geoJsonData: any): void {
    if (this.capaDepartamentos) this.map.removeLayer(this.capaDepartamentos);

    this.capaDepartamentos = L.geoJSON(geoJsonData, {
      style: {
        color: '#a35b86',
        weight: 3,
        dashArray: '8, 8',
        fillColor: '#f4eaf2',
        fillOpacity: 0.1
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<b>Departamento:</b> ${feature.properties.nombre}`);
      }
    }).addTo(this.map);

    if (geoJsonData.features?.length > 0) {
      this.map.flyToBounds(this.capaDepartamentos.getBounds(), { padding: [20, 20] });
    }
  }

  private dibujarMunicipios(geoJsonData: any): void {
    this.capaMunicipios = L.geoJSON(geoJsonData, {
      style: {
        color: '#666666',
        weight: 2,
        dashArray: '5, 5',
        fillOpacity: 0.05
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<b>Municipio:</b> ${feature.properties.nombre}`);
        layer.on({
          mouseover: (e) => {
            const polygon = e.target;
            polygon.setStyle({
              weight: 4,
              color: '#88baec',
              fillOpacity: 0.5
            });
            polygon.bringToFront();
          },
          mouseout: (e) => {
            if (this.capaMunicipios) {
              this.capaMunicipios.resetStyle(e.target);
            }
          },
          click: () => {
            this.cargarComunidades(feature.properties.id);
          }
        });
      }
    }).addTo(this.map);

    if (geoJsonData.features?.length > 0) {
      this.map.flyToBounds(this.capaMunicipios.getBounds(), { padding: [50, 50] });
    }
  }

  private cargarComunidades(municipioId: number): void {
    this.isLoading.set(true);
    this.geoService.getComunidades(municipioId).subscribe({
      next: (geoJsonData) => {
        this.isLoading.set(false);

        const comus = geoJsonData.features.map((f: any) => f.properties)
          .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
        this.comunidades.set(comus);

        this.dibujarComunidades(geoJsonData);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error comunidades:', err);
      }
    });
  }

  private dibujarComunidades(geoJsonData: any): void {
    if (this.capaComunidades) this.map.removeLayer(this.capaComunidades);

    this.capaComunidades = L.geoJSON(geoJsonData, {
      style: { color: '#4CAF50', weight: 2, fillColor: '#81C784', fillOpacity: 0.6 },

      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 6,
          color: '#4CAF50',
          weight: 2,
          fillColor: '#81C784',
          fillOpacity: 0.8
        });
      },

      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<b>Comunidad:</b> ${feature.properties.nombre}`);
      }
    }).addTo(this.map);

    if (geoJsonData.features?.length > 0) {
      this.map.flyToBounds(this.capaComunidades.getBounds(), { padding: [30, 30] });
    }
  }

  private limpiarCapas(): void {
    if (this.capaMunicipios) this.map.removeLayer(this.capaMunicipios);
    if (this.capaComunidades) this.map.removeLayer(this.capaComunidades);
    if (this.capaApa) this.map.removeLayer(this.capaApa);
  }

  cerrarSesion() {
    this.authService.logout();
  }

  private cargarUsuario(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser.set(JSON.parse(userStr));
    }
  }

  resetMapa(): void {
    this.departamentoSeleccionado.set(null);
    this.municipioSeleccionado.set(null);
    this.comunidadSeleccionada.set(null);
    this.limpiarCapas();

    if (this.capaDepartamentos) {
      this.map.flyToBounds(this.capaDepartamentos.getBounds(), { duration: 1.5, padding: [20, 20] });
    } else {
      this.map.flyTo([-16.5, -64.15], 5, { duration: 1.5 });
    }

    this.datosPanel.set(null);
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }

  private cargarEstadisticas(nivel: string, id: number, nombresUbicacion: any): void {
    this.geoService.getEstadisticas(nivel, id).subscribe({
      next: (stats) => {
        this.datosPanel.set({
          nivelPanel: nivel,
          ...nombresUbicacion,
          ...stats
        });
      },
      error: (err) => console.error('Error al cargar las estadisticas', err)
    });
  }

  descargarReporte(): void {
    const panel = this.datosPanel();
    if (!panel) return;

    this.isDownloading.set(true);

    let id = 0;
    if (panel.nivelPanel === 'departamental') id = +this.departamentoSeleccionado();
    else if (panel.nivelPanel === 'municipal') id = +this.municipioSeleccionado();
    else if (panel.nivelPanel === 'comunidad') id = +this.comunidadSeleccionada();

    this.geoService.descargarExcel(panel.nivelPanel, id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_${panel.nivelPanel}_${id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.isDownloading.set(false);
      },
      error: (err) => {
        console.error('Error al descargar el archivo', err);
        this.isDownloading.set(false);
      }
    });
  }
}
