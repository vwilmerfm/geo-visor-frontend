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
  private capaPoligonosComunidad: L.GeoJSON | null = null;
  private capaApa: L.GeoJSON | null = null;
  private layerControl: L.Control.Layers | null = null;

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
  // POR SI ACASO
  // verComunidades = signal<boolean>(true);

  ngOnInit(): void {
    this.iniciarMapa();
    this.cargarListaDepartamentos();
    this.cargarUsuario();
  }

  /* ======= POR SI ACASO SW =======
    toggleComunidades(mostrar: boolean): void {
      this.verComunidades.set(mostrar);
      if (this.capaComunidades) {
        if (mostrar) {
          this.map.addLayer(this.capaComunidades);
        } else {
          this.map.removeLayer(this.capaComunidades);
        }
      }
    }
   ================================= */

  private iniciarMapa(): void {
    setTimeout(() => {
      const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OSM Instituto Nacional de Estadística'
      });

      /* ======= VISTA SATELITAL =======
            const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
              maxZoom: 18,
              attribution: '© OSM Instituto Nacional de Estadística'
            });
      =================================== */

      this.map = L.map('mapa-visor-censo', {
        center: [-16.5, -64.15],
        zoom: 5,
        layers: [calles]
      });

      this.map.createPane('fronterasComunidadPane');
      this.map.getPane('fronterasComunidadPane')!.style.zIndex = '450';

      const baseMaps = {
        "Mapa de Calles": calles,
        // "Vista Satelital": satelite
      };

      this.layerControl = L.control.layers(baseMaps).addTo(this.map);

      this.map.on('zoomend', () => {
        const nivelZoom = this.map.getZoom();

        const mostrarNombresFijos = nivelZoom >= 12;

        if (this.capaComunidades) {
          this.capaComunidades.eachLayer((layer: any) => {
            const tooltip = layer.getTooltip();
            if (tooltip) {
              if (mostrarNombresFijos) {
                tooltip.options.permanent = true;
                layer.openTooltip();
              } else {
                tooltip.options.permanent = false;
                layer.closeTooltip();
              }
            }
          });
        }
      });

      L.control.scale({
        imperial: false,
        position: 'bottomleft'
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
    this.municipioSeleccionado.set(null);
    this.comunidades.set([]);
    this.comunidadSeleccionada.set(null);

    if (this.capaDepartamentos) {
      this.capaDepartamentos.eachLayer((layer: any) => {
        if (id && layer.feature.properties.id === +id) {
          layer.setStyle({
            weight: 4,
            color: '#1976D2',
            dashArray: '',
            fillColor: 'transparent',
            fillOpacity: 0
          });
          if (layer.bringToFront) layer.bringToFront();
        } else if (id) {
          layer.setStyle({
            weight: 2,
            color: '#999999',
            dashArray: '5, 5',
            fillColor: '#ffffff',
            fillOpacity: 0.5
          });
        } else {
          layer.setStyle({
            color: '#a35b86',
            weight: 3,
            dashArray: '8, 8',
            fillColor: '#f4eaf2',
            fillOpacity: 0.1
          });
        }
      });
    }

    if (!id) {
      this.datosPanel.set(null);
      if (this.capaDepartamentos) {
        this.map.flyToBounds(this.capaDepartamentos.getBounds(), { duration: 1.5, padding: [20, 20] });
      }
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

        this.cargarEstadisticas('departamental', +id, { departamento: deptoObj?.nombre });
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error cargando municipios:', err);
      }
    });
  }

  onMunicipioChange(): void {
    const id = this.municipioSeleccionado();

    this.comunidadSeleccionada.set(null);
    if (this.capaApa) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaApa);
      this.map.removeLayer(this.capaApa);
    }

    if (this.capaMunicipios) {
      this.capaMunicipios.eachLayer((layer: any) => {
        if (id && layer.feature.properties.id === +id) {
          layer.setStyle({
            weight: 3,
            color: '#1976D2',
            dashArray: '',
            fillColor: '#bbdefb',
            fillOpacity: 0.35
          });

          if (layer.bringToFront) {
            layer.bringToFront();
          }
        } else {
          layer.setStyle({
            weight: 2,
            color: '#666666',
            dashArray: '5, 5',
            fillColor: '#ffffff',
            fillOpacity: 0.05
          });
        }
      });
    }

    if (!id) {
      if (this.capaComunidades) {
        if (this.layerControl) this.layerControl.removeLayer(this.capaComunidades);
        this.map.removeLayer(this.capaComunidades);
      }

      if (this.capaPoligonosComunidad) {
        if (this.layerControl) this.layerControl.removeLayer(this.capaPoligonosComunidad);
        this.map.removeLayer(this.capaPoligonosComunidad);
      }

      this.comunidades.set([]);

      const deptoObj = this.departamentos().find(d => d.id === +this.departamentoSeleccionado());
      if (deptoObj) {
        this.cargarEstadisticas('departamental', +this.departamentoSeleccionado(), { departamento: deptoObj.nombre });
        if (this.capaMunicipios) this.map.flyToBounds(this.capaMunicipios.getBounds(), { padding: [30, 30] });
      }
      return;
    }

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
          departamento: deptoObj?.nombre,
          municipio: muniObj?.nombre
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error cargando comunidades:', err);
      }
    });
  }

  onComunidadChange(): void {
    const id = this.comunidadSeleccionada();
    if (!id || !this.capaComunidades) return;

    /* ======= SWITCH =======
    if (!this.verComunidades()) {
      this.verComunidades.set(true);
      this.map.addLayer(this.capaComunidades);
    }
    ========================== */

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

    if (this.capaApa) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaApa);
      this.map.removeLayer(this.capaApa);
    }

    this.geoService.getApaComunidad(+id).subscribe({
      next: (geoJsonData) => {
        this.capaApa = L.geoJSON(geoJsonData, {
          style: {
            color: '#8c5b55',
            weight: 2,
            fillColor: '#8c5b55',
            fillOpacity: 0.25
          },
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`<b>Área de Producción Agropecuaria</b>`, {
              sticky: true,
              className: 'hover-tooltip'
            });
          }
        }).addTo(this.map);

        if (geoJsonData.features?.length > 0) {
          this.map.flyToBounds(this.capaApa.getBounds(), { padding: [40, 40], maxZoom: 15 });
        }

        this.capaApa.bringToBack();

        if (this.layerControl) {
          this.layerControl.addOverlay(this.capaApa, "🟫 Region APA");
        }
      },
      error: (err) => console.error('Error cargando el poligono APA:', err)
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
        fillOpacity: 0.5
      },
      onEachFeature: (feature, layer) => {

        layer.bindTooltip(`<b>Dpto.:</b> ${feature.properties.nombre}`, {
          permanent: false,
          direction: 'center',
          className: 'hover-tooltip-depto'
        });

        layer.on({
          click: () => {
            layer.closeTooltip();
            this.departamentoSeleccionado.set(feature.properties.id);
            this.onDepartamentoChange();
          }
        });

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
        layer.bindTooltip(`<b>Mcpio.:</b> ${feature.properties.nombre}`, {
          permanent: false,
          direction: 'center',
          className: 'hover-tooltip-muni'
        });
        layer.on({
          mouseover: (e) => {
            const idSel = this.municipioSeleccionado();
            if (idSel && feature.properties.id === +idSel) return;

            const polygon = e.target;
            polygon.setStyle({
              weight: 4,
              color: '#fbe6aa',
              fillOpacity: 0.5
            });
            polygon.bringToFront();
          },
          mouseout: (e) => {
            const idSel = this.municipioSeleccionado();
            if (idSel && feature.properties.id === +idSel) return;

            if (this.capaMunicipios) {
              this.capaMunicipios.resetStyle(e.target);
            }
          },
          click: () => {
            layer.closeTooltip();
            this.municipioSeleccionado.set(feature.properties.id);
            this.onMunicipioChange();
          }
        });
      }
    }).addTo(this.map);

    if (geoJsonData.features?.length > 0) {
      this.map.flyToBounds(this.capaMunicipios.getBounds(), { padding: [50, 50] });
    }
  }

  private dibujarComunidades(geoJsonData: any): void {
    if (this.capaComunidades) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaComunidades);
      this.map.removeLayer(this.capaComunidades);
    }

    if (this.capaPoligonosComunidad) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaPoligonosComunidad);
      this.map.removeLayer(this.capaPoligonosComunidad);
    }

    this.capaPoligonosComunidad = L.geoJSON(geoJsonData, {
      pane: 'fronterasComunidadPane',
      filter: (feature) => feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon',
      style: {
        color: '#555555',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#ffffff',
        fillOpacity: 0.05
      },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(`<b>${feature.properties.nombre}</b>`, {
          permanent: false,
          direction: 'center',
          className: 'hover-tooltip label-halo'
        });

        layer.on({
          mouseover: (e) => {
            const polygon = e.target;
            polygon.setStyle({
              weight: 3,
              color: '#4CAF50',
              fillColor: '#C8E6C9',
              fillOpacity: 0.4
            });
          },
          mouseout: (e) => {
            if (this.capaPoligonosComunidad) {
              this.capaPoligonosComunidad.resetStyle(e.target);
            }
          },
          click: () => {
            layer.closeTooltip();
            this.comunidadSeleccionada.set(feature.properties.id);
            this.onComunidadChange();
          }
        });
      }
    }).addTo(this.map);

    this.capaComunidades = L.geoJSON(geoJsonData, {
      pane: 'markerPane',
      filter: (feature) => feature.geometry.type === 'Point',
      style: { color: '#4CAF50', weight: 2, fillColor: '#81C784', fillOpacity: 0.6 },
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          pane: 'markerPane',
          radius: 6,
          color: '#4CAF50',
          weight: 2,
          fillColor: '#81C784',
          fillOpacity: 0.8
        });
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<b>Comunidad:</b> ${feature.properties.nombre}`);
        layer.bindTooltip(`<b>${feature.properties.nombre}</b>`, {
          permanent: false,
          direction: 'top',
          offset: [0, -5],
          className: 'hover-tooltip label-halo'
        });
        layer.on({
          click: () => {
            layer.closeTooltip();
            this.comunidadSeleccionada.set(feature.properties.id);
            this.onComunidadChange();
          }
        });
      }
    }).addTo(this.map);

    if (this.layerControl) {
      this.layerControl.addOverlay(this.capaPoligonosComunidad, "🔲 Polígonos de Comunidad");
      this.layerControl.addOverlay(this.capaComunidades, "🟢 Puntos de Comunidad");
    }

    if (geoJsonData.features?.length > 0) {
      this.map.flyToBounds(this.capaComunidades.getBounds(), { padding: [30, 30] });
    }
  }

  private limpiarCapas(): void {
    if (this.capaMunicipios) this.map.removeLayer(this.capaMunicipios);

    if (this.capaComunidades) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaComunidades);
      this.map.removeLayer(this.capaComunidades);
    }
    if (this.capaApa) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaApa);
      this.map.removeLayer(this.capaApa);
    }
    if (this.capaPoligonosComunidad) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaPoligonosComunidad);
      this.map.removeLayer(this.capaPoligonosComunidad);
    }
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
