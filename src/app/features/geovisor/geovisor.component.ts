import { Component, OnInit, inject, signal } from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import * as L from 'leaflet';
import { GeovisorService } from '../../core/services/geovisor.service';
import { AuthService } from '../../core/services/auth.service';
import { NgOptimizedImage, DecimalPipe } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import {Router} from '@angular/router';

@Component({
  selector: 'app-geovisor',
  standalone: true,
  imports: [FormsModule, NgOptimizedImage, ReactiveFormsModule, NgSelectModule, DecimalPipe],
  templateUrl: './geovisor.component.html',
  styleUrl: './geovisor.component.scss'
})
export class GeovisorComponent implements OnInit {
  private geoService = inject(GeovisorService);
  private router = inject(Router);

  private map!: L.Map;

  private capaDepartamentos: L.GeoJSON | null = null;
  private capaMunicipios: L.GeoJSON | null = null;
  private capaComunidades: L.GeoJSON | null = null;
  private capaPoligonosComunidad: L.GeoJSON | null = null;
  private capaApa: L.GeoJSON | null = null;
  private capaSectores: L.GeoJSON | null = null;
  private capaPredios: L.GeoJSON | null = null;
  private capaManzanos: L.GeoJSON | null = null;
  private capaPeriurbano: L.GeoJSON | null = null;
  private capaUpas: L.GeoJSON | null = null;
  private capaAreaCensal: L.GeoJSON | null = null;

  private layerControl: L.Control.Layers | null = null;

  isLoading = signal(false);
  isSidebarOpen = signal(false);
  isDownloading = signal(false);
  isDownloadingSectores = signal(false);

  departamentos = signal<any[]>([]);
  municipios = signal<any[]>([]);
  comunidades = signal<any[]>([]);

  departamentoSeleccionado = signal<any>(null);
  municipioSeleccionado = signal<any>(null);
  comunidadSeleccionada = signal<any>(null);

  private authService = inject(AuthService);
  currentUser = signal<{username: string, role: string} | null>(null);

  datosPanel = signal<any>(null);

  private capaSuperArea: L.GeoJSON | null = null;
  private capaAreaTrabajo: L.GeoJSON | null = null;

  ngOnInit(): void {
    this.iniciarMapa();
    this.cargarListaDepartamentos();
    this.cargarUsuario();
  }

  private iniciarMapa(): void {
    setTimeout(() => {
      const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OSM Instituto Nacional de Estadística'
      });

      const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '© OSM Instituto Nacional de Estadística'
      });

      this.map = L.map('mapa-visor-censo', {
        center: [-16.5, -64.15],
        zoom: 5,
        layers: [calles]
      });

      this.map.createPane('areaCensalPane');
      this.map.getPane('areaCensalPane')!.style.zIndex = '410';

      this.map.createPane('areaTrabajoPane');
      this.map.getPane('areaTrabajoPane')!.style.zIndex = '420';

      this.map.createPane('sectoresPane');
      this.map.getPane('sectoresPane')!.style.zIndex = '430';

      this.map.createPane('superAreaPane');
      this.map.getPane('superAreaPane')!.style.zIndex = '440';

      this.map.createPane('apaPane');
      this.map.getPane('apaPane')!.style.zIndex = '450';

      this.map.createPane('fronterasComunidadPane');
      this.map.getPane('fronterasComunidadPane')!.style.zIndex = '460';

      this.map.createPane('manzanosPane');
      this.map.getPane('manzanosPane')!.style.zIndex = '425';

      this.map.createPane('periurbanoPane');
      this.map.getPane('periurbanoPane')!.style.zIndex = '428';

      const baseMaps = {
        "Mapa de Calles": calles,
        "Vista Satelital": satelite
      };

      const ordenCapas = [
        "Súper Área Censal",
        "Área Censal",
        "Sector",
        "Áreas de trabajo",
        "Comunidad",
        "Predios",
        "Manzanos",
        "APA"
      ];

      this.layerControl = L.control.layers(baseMaps, undefined, {
        sortLayers: true,
        sortFunction: (layerA, layerB, nameA, nameB) => {
          let idxA = ordenCapas.findIndex(palabra => nameA.includes(palabra));
          let idxB = ordenCapas.findIndex(palabra => nameB.includes(palabra));

          if (idxA === -1) idxA = 99;
          if (idxB === -1) idxB = 99;

          return idxA - idxB;
        }
      }).addTo(this.map);

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

        const mostrarSectoresFijos = nivelZoom >= 14;

        if (this.capaSectores) {
          this.capaSectores.eachLayer((layer: any) => {
            const tooltip = layer.getTooltip();
            if (tooltip) {
              if (mostrarSectoresFijos) {
                tooltip.options.permanent = true;
                layer.openTooltip();
              } else {
                tooltip.options.permanent = false;
                layer.closeTooltip();
              }
            }
          });
        }

        const mostrarManzanosFijos = nivelZoom >= 15;
        if (this.capaManzanos) {
          this.capaManzanos.eachLayer((layer: any) => {
            const tooltip = layer.getTooltip();
            if (tooltip) {
              if (mostrarManzanosFijos) {
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
          if (layer.bringToFront)
            layer.bringToFront();
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
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaApa);

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
        if (this.layerControl)
          this.layerControl.removeLayer(this.capaComunidades);
        this.map.removeLayer(this.capaComunidades);
      }

      if (this.capaPoligonosComunidad) {
        if (this.layerControl)
          this.layerControl.removeLayer(this.capaPoligonosComunidad);
        this.map.removeLayer(this.capaPoligonosComunidad);
      }

      if (this.capaSectores) {
        if (this.layerControl)
          this.layerControl.removeLayer(this.capaSectores);
        this.map.removeLayer(this.capaSectores);
      }

      this.comunidades.set([]);

      const deptoObj = this.departamentos().find(d => d.id === +this.departamentoSeleccionado());

      if (deptoObj) {
        this.cargarEstadisticas('departamental', +this.departamentoSeleccionado(), { departamento: deptoObj.nombre });
        if (this.capaMunicipios)
          this.map.flyToBounds(this.capaMunicipios.getBounds(), { padding: [30, 30] });
      }

      const capas = [
        this.capaPredios,
        this.capaAreaCensal,
        this.capaSuperArea,
        this.capaAreaTrabajo,
        this.capaManzanos,
        this.capaPeriurbano,
        this.capaUpas
      ];

      capas.forEach(capa => {
        if (capa) {
          if (this.layerControl)
            this.layerControl.removeLayer(capa);

          this.map.removeLayer(capa);
        }
      });

      return;
    }

    const deptoObj = this.departamentos().find(d => d.id === +this.departamentoSeleccionado());
    const muniObj = this.municipios().find(m => m.id === +id);

    this.isLoading.set(true);

    this.geoService.getComunidades(+id).subscribe({
      next: (geoJsonData) => {
        this.isLoading.set(false);

        const comus = geoJsonData.features
          .map((f: any) => f.properties)
          .filter((valor: any, indice: number, arreglo: any[]) =>
            arreglo.findIndex(t => t.nombre === valor.nombre) === indice
          )
          .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
        this.comunidades.set(comus);

        this.dibujarComunidades(geoJsonData);

        this.cargarEstadisticas('municipal', +id, {
          departamento: deptoObj?.nombre,
          municipio: muniObj?.nombre
        });

        if (this.capaSectores) {
          if (this.layerControl)
            this.layerControl.removeLayer(this.capaSectores);

          this.map.removeLayer(this.capaSectores);
        }

        this.geoService.getSectoresPorMunicipio(+id).subscribe({
          next: (dataSectores) => this.dibujarSectores(dataSectores, false),
          error: (err) => console.error(err)
        });

        this.geoService.getPrediosMunicipio(+id).subscribe({ next: (d) => this.dibujarPredios(d) });
        this.geoService.getAreaCensalMunicipio(+id).subscribe({ next: (d) => this.dibujarAreaCensal(d) });
        this.geoService.getManzanosMunicipio(+id).subscribe({ next: (d) => this.dibujarManzanos(d) });
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error cargando comunidades:', err);
      }
    });

    this.geoService.getSuperAreaMunicipio(+id).subscribe({
      next: (data) => this.dibujarSuperArea(data)
    });

    this.geoService.getAreaTrabajoMunicipio(+id).subscribe({
      next: (data) => this.dibujarAreaTrabajo(data)
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
            color: '#1B5E20',
            fillColor: '#00E676',
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
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaApa);

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
          this.layerControl.addOverlay(this.capaApa, "🟫 Region Comunidad");
        }
      },
      error: (err) => console.error('Error cargando el poligono APA:', err)
    });

    if (this.capaSectores) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaSectores);

      this.map.removeLayer(this.capaSectores);
    }

    this.geoService.getSectores(+id).subscribe({
      next: (geoJsonData) => {
        this.dibujarSectores(geoJsonData, true);
      },
      error: (err) => console.error('Error cargando los sectores:', err)
    });
  }

  private dibujarDepartamentos(geoJsonData: any): void {
    if (this.capaDepartamentos)
      this.map.removeLayer(this.capaDepartamentos);

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
      this.layerControl.addOverlay(this.capaPoligonosComunidad, "🔲 APA's");
      this.layerControl.addOverlay(this.capaComunidades, "🟢 Comunidad/Hacienda");
    }

    if (geoJsonData.features?.length > 0) {
      this.map.flyToBounds(this.capaComunidades.getBounds(), { padding: [30, 30] });
    }
  }

  private dibujarSectores(geoJsonData: any, mostrarNumerosFijos: boolean = true): void {
    if (this.capaSectores) {
      if (this.layerControl) this.layerControl.removeLayer(this.capaSectores);
      this.map.removeLayer(this.capaSectores);
    }

    const zoomInicial = this.map.getZoom();

    this.capaSectores = L.geoJSON(geoJsonData, {
      pane: 'sectoresPane',
      style: {
        color: '#1976D2',
        weight: 1.5,
        fillColor: '#1976D2',
        fillOpacity: 0,
        dashArray: ''
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`<div style="text-align: center;">
                           <b>Sector CA:</b><br>
                           <span style="font-size: 1.2em; color: #0D47A1; font-weight: bold;">
                             ${feature.properties.sector_ca}
                           </span>
                         </div>`);

        layer.bindTooltip(feature.properties.sector_ca, {
          permanent: zoomInicial >= 14,
          direction: 'center',
          className: 'sector-label'
        });

        layer.on({
          mouseover: (e) => e.target.setStyle({
            fillOpacity: 0.15,
            weight: 2.5
          }),
          mouseout: (e) => {
            if (this.capaSectores) this.capaSectores.resetStyle(e.target);
          }
        });
      }
    });

    if (this.layerControl)
      this.layerControl.addOverlay(this.capaSectores, "🟦 Sector");
  }

  private limpiarCapas(): void {
    if (this.capaMunicipios)
      this.map.removeLayer(this.capaMunicipios);

    if (this.capaComunidades) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaComunidades);

      this.map.removeLayer(this.capaComunidades);
    }

    if (this.capaApa) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaApa);

      this.map.removeLayer(this.capaApa);
    }

    if (this.capaPoligonosComunidad) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaPoligonosComunidad);

      this.map.removeLayer(this.capaPoligonosComunidad);
    }

    if (this.capaSectores) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaSectores);

      this.map.removeLayer(this.capaSectores);
    }

    if (this.capaSuperArea) {
      this.map.removeLayer(this.capaSuperArea);

      if (this.layerControl)
        this.layerControl.removeLayer(this.capaSuperArea);
    }

    if (this.capaAreaTrabajo) {
      this.map.removeLayer(this.capaAreaTrabajo);

      if (this.layerControl)
        this.layerControl.removeLayer(this.capaAreaTrabajo);
    }

    const capas = [this.capaPredios, this.capaManzanos, this.capaPeriurbano, this.capaUpas, this.capaAreaCensal];
    capas.forEach(capa => {
      if (capa) {
        if (this.layerControl)
          this.layerControl.removeLayer(capa);

        this.map.removeLayer(capa);
      }
    });
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

  private dibujarPredios(geoJsonData: any): void {
    this.capaPredios = L.geoJSON(geoJsonData, {
      pane: 'markerPane', filter: (f) => f.geometry.type === 'Point',
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 2.5, color: '#212121', fillColor: '#212121', fillOpacity: 1 })
    });

    if (this.layerControl)
      this.layerControl.addOverlay(this.capaPredios, "⚫ Predios");
  }

  private dibujarAreaCensal(geoJsonData: any): void {
    if (this.capaAreaCensal) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaAreaCensal);

      this.map.removeLayer(this.capaAreaCensal);
    }

    this.capaAreaCensal = L.geoJSON(geoJsonData, {
      pane: 'areaCensalPane',
      interactive: false,
      style: {
        color: '#f305ff',
        weight: 4.5,
        fillColor: '#fa80ff',
        fillOpacity: 0.4
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties.areacensal_ca) {
          layer.bindTooltip(feature.properties.areacensal_ca, { permanent: true, direction: 'center', className: 'label-areacensal' });
        }
      }
    });

    if (this.layerControl)
      this.layerControl.addOverlay(this.capaAreaCensal, "<span style='color: #f305ff; font-size: 2em;'>●</span> Área Censal");
  }

  descargarReporteSectoresMunicipal(): void {
    const id = this.municipioSeleccionado();
    if (!id) return;

    this.isDownloadingSectores.set(true);

    this.geoService.descargarExcelSectoresMunicipal(+id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Municipio_${id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.isDownloadingSectores.set(false);
      },
      error: (err) => {
        console.error('Error al descargar el archivo', err);
        this.isDownloadingSectores.set(false);
      }
    });
  }

  private dibujarSuperArea(geoJsonData: any): void {
    if (this.capaSuperArea) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaSuperArea);

      this.map.removeLayer(this.capaSuperArea);
    }

    this.capaSuperArea = L.geoJSON(geoJsonData, {
      pane: 'superAreaPane',
      interactive: false,
      style: {
        color: '#4daf4a',
        weight: 7,
        fillColor: '#4daf4a',
        fillOpacity: 0
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties.superarea_ca) {
          layer.bindTooltip(feature.properties.superarea_ca, { permanent: true, direction: 'center', className: 'label-superarea' });
        }
      }
    });

    if (this.layerControl)
      this.layerControl.addOverlay(this.capaSuperArea, "🟩 Súper Área Censal");
  }

  private dibujarAreaTrabajo(geoJsonData: any): void {
    if (this.capaAreaTrabajo) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaAreaTrabajo);

      this.map.removeLayer(this.capaAreaTrabajo);
    }

    this.capaAreaTrabajo = L.geoJSON(geoJsonData, {
      pane: 'areaTrabajoPane',
      style: {
        color: '#e41a1c',
        weight: 2.5,
        fillColor: '#f28c8d',
        fillOpacity: 0,
        dashArray: '5, 5'
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties.at_ca) {
          layer.bindTooltip(feature.properties.at_ca, { permanent: true, direction: 'center', className: 'label-areatrabajo' });
        }
      }
    });

    if (this.layerControl)
      this.layerControl.addOverlay(this.capaAreaTrabajo, "🟥 Áreas de trabajo");
  }

  private dibujarManzanos(geoJsonData: any): void {
    if (this.capaManzanos) {
      if (this.layerControl)
        this.layerControl.removeLayer(this.capaManzanos);

      this.map.removeLayer(this.capaManzanos);
    }

    const zoomInicial = this.map.getZoom();

    this.capaManzanos = L.geoJSON(geoJsonData, {
      pane: 'manzanosPane',
      style: { color: '#ffffff', weight: 1.5, fillColor: '#9e9e9e', fillOpacity: 0.9, dashArray: '' },
      onEachFeature: (feature, layer) => {
        if (feature.properties.orden_manz) {
          layer.bindTooltip(feature.properties.orden_manz.toString(), {
            permanent: zoomInicial >= 15,
            direction: 'center',
            className: 'label-manzano'
          });
        }
      }
    });

    if (this.layerControl)
      this.layerControl.addOverlay(this.capaManzanos, "⬜ Manzanos");
  }

  irAAdminPanel(): void {
    this.router.navigate(['/admin-usuarios']);
  }
}
