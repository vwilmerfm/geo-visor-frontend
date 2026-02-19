import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { GeovisorService } from '../../core/services/geovisor.service';

@Component({
  selector: 'app-geo-ejemplo',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './geo-ejemplo.component.html',
  styleUrl: './geo-ejemplo.component.scss'
})
export class GeoEjemploComponent implements OnInit {
  private geoService = inject(GeovisorService);
  private map!: L.Map;

  private capaMunicipios: L.GeoJSON | null = null;
  private capaComunidades: L.GeoJSON | null = null;

  isLoading = signal(false);

  departamentos = signal<any[]>([]);
  municipios = signal<any[]>([]);
  comunidades = signal<any[]>([]);

  departamentoSeleccionado = signal<string>('');
  municipioSeleccionado = signal<string>('');
  comunidadSeleccionada = signal<string>('');

  ngOnInit(): void {
    this.iniciarMapa();
    this.cargarListaDepartamentos();
  }

  private iniciarMapa(): void {
    setTimeout(() => {
      this.map = L.map('mapa-censo-ejemplo').setView([-16.5, -68.15], 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap INE'
      }).addTo(this.map);

      this.map.invalidateSize();
    }, 0);
  }

  private cargarListaDepartamentos(): void {
    this.geoService.getDepartamentos().subscribe({
      next: (data) => {
        const deptos = data.features.map((f: any) => ({
          id: f.properties.id,
          nombre: f.properties.nombre
        }));
        this.departamentos.set(deptos);
      }
    });
  }

  onDepartamentoChange(): void {
    const id = this.departamentoSeleccionado();
    this.limpiarCapas();
    this.municipios.set([]);
    this.municipioSeleccionado.set('');

    if (!id) return;

    this.isLoading.set(true);
    this.geoService.getMunicipios(+id).subscribe({
      next: (geoJsonData) => {
        this.isLoading.set(false);
        this.municipios.set(geoJsonData.features.map((f: any) => f.properties));
        this.dibujarMunicipios(geoJsonData);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onMunicipioChange(): void {
    const id = this.municipioSeleccionado();
    if (!id) return;

    this.isLoading.set(true);
    this.geoService.getComunidades(+id).subscribe({
      next: (geoJsonData) => {
        this.isLoading.set(false);
        this.comunidades.set(geoJsonData.features.map((f: any) => f.properties));
        this.dibujarComunidades(geoJsonData);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onComunidadChange(): void {
    const id = this.comunidadSeleccionada();
    if (!id || !this.capaComunidades) return;

    this.capaComunidades.eachLayer((layer: any) => {
      if (layer.feature.properties.id === +id) {
        this.map.flyToBounds(layer.getBounds(), { padding: [40, 40] });

        layer.openPopup();

        layer.setStyle({
          weight: 5,
          color: '#FFD600',
          fillOpacity: 0.8
        });
      } else {
        this.capaComunidades?.resetStyle(layer);
      }
    });
  }

  private dibujarComunidades(geoJsonData: any): void {
    if (this.capaComunidades) this.map.removeLayer(this.capaComunidades);

    this.capaComunidades = L.geoJSON(geoJsonData, {
      style: { color: '#4CAF50', weight: 2, fillColor: '#81C784', fillOpacity: 0.6 },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<b>Comunidad:</b> ${feature.properties.nombre}`);
      }
    }).addTo(this.map);

    if (geoJsonData.features?.length > 0) {
      this.map.flyToBounds(this.capaComunidades.getBounds(), { padding: [30, 30] });
    }
  }

  private dibujarMunicipios(geoJsonData: any): void {
    this.capaMunicipios = L.geoJSON(geoJsonData, {
      style: { color: '#1976D2', weight: 2, fillColor: '#2196F3', fillOpacity: 0.3 },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<b>Municipio:</b> ${feature.properties.nombre}`);

        layer.on('click', () => {
          this.cargarComunidades(feature.properties.id);
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
        if (this.capaComunidades) {
          this.map.removeLayer(this.capaComunidades);
        }

        this.capaComunidades = L.geoJSON(geoJsonData, {
          style: { color: '#4CAF50', weight: 2, fillColor: '#81C784', fillOpacity: 0.6 },
          onEachFeature: (feature, layer) => {
            layer.bindPopup(`<b>Comunidad:</b> ${feature.properties.nombre}`);
          }
        }).addTo(this.map);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error comunidades:', err);
      }
    });
  }

  private limpiarCapas(): void {
    if (this.capaMunicipios) this.map.removeLayer(this.capaMunicipios);
    if (this.capaComunidades) this.map.removeLayer(this.capaComunidades);
  }
}
