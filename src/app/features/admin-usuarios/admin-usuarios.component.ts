import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../../core/services/usuario.service';
import {AuthService} from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, NgOptimizedImage],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.scss'
})
export class AdminUsuariosComponent implements OnInit {
  private usuarioService = inject(UsuarioService);
  private router = inject(Router);
  private authService = inject(AuthService);

  usuariosLocales = signal<any[]>([]);
  roles = signal<any[]>([]);
  terminoBusqueda = signal('');
  resultadosAD = signal<any[]>([]);
  isSearching = signal(false);
  filtroLocal = signal('');

  usuarioActual = signal<any>(null);

  usuariosLocalesFiltrados = computed(() => {
    const termino = this.filtroLocal().toLowerCase();

    if (!termino)
      return this.usuariosLocales();

    return this.usuariosLocales().filter(u =>
      u.username.toLowerCase().includes(termino) ||
      (u.email && u.email.toLowerCase().includes(termino)) ||
      (u.rol_nombre && u.rol_nombre.toLowerCase().includes(termino))
    );
  });

  pageAD = signal(1);
  pageSizeAD = signal(5);
  paginatedAD = computed(() => {
    const start = (this.pageAD() - 1) * this.pageSizeAD();
    return this.resultadosAD().slice(start, start + this.pageSizeAD());
  });
  totalPagesAD = computed(() => Math.ceil(this.resultadosAD().length / this.pageSizeAD()) || 1);

  pageLocal = signal(1);
  pageSizeLocal = signal(10);
  paginatedLocal = computed(() => {
    const start = (this.pageLocal() - 1) * this.pageSizeLocal();
    return this.usuariosLocalesFiltrados().slice(start, start + this.pageSizeLocal());
  });
  totalPagesLocal = computed(() => Math.ceil(this.usuariosLocalesFiltrados().length / this.pageSizeLocal()) || 1);

  showAdminModal = signal(false);
  isSavingAdmin = signal(false);
  mostrarPasswordLocal = signal(false);
  nuevoAdmin = signal({ username: '', email: '', password: '', origen_auth: 'LOCAL', rol_id: 1 });

  showConfirmModal = signal(false);
  usuarioSeleccionadoAD = signal<any>(null);
  tipoConfirmacion = signal<'AD' | 'LOCAL' | 'ESTADO'>('AD');

  busquedaRealizada = signal(false);

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');

    if (userStr) {
      this.usuarioActual.set(JSON.parse(userStr));
    }

    this.cargarRoles();
    this.cargarUsuariosLocales();
  }

  volverAlMapa(): void { this.router.navigate(['/mapa']); }

  onFiltroLocalChange(): void {
    this.pageLocal.set(1);
  }

  cargarRoles(): void {
    this.usuarioService.getRoles().subscribe({
      next: (data) => this.roles.set(data),
      error: (err) => this.roles.set([{id: 1, nombre: 'administrador'}, {id: 2, nombre: 'usuario'}])
    });
  }

  cargarUsuariosLocales(): void {
    this.usuarioService.getUsuarios().subscribe({
      next: (data) => {
        this.usuariosLocales.set(data);
        this.pageLocal.set(1);
      },
      error: (err) => console.error('Error al cargar usuarios locales', err)
    });
  }

  buscarEnAD(): void {
    const termino = this.terminoBusqueda().trim();

    if (termino.length < 3) {
      alert('Por favor, ingresa al menos 3 caracteres para buscar.');
      return;
    }

    this.isSearching.set(true);
    this.resultadosAD.set([]);
    this.busquedaRealizada.set(false);
    this.pageAD.set(1);

    this.usuarioService.buscarUsuariosAD(termino).subscribe({
      next: (data) => {
        const procesados = data.map(u => ({ ...u, selectedRole: 2, isSaving: false }));
        this.resultadosAD.set(procesados);
        this.isSearching.set(false);
        this.busquedaRealizada.set(true);
      },
      error: (err) => {
        console.error('Error buscando en AD', err);
        alert('Error al conectar con el Active Directory.');
        this.isSearching.set(false);
        this.busquedaRealizada.set(false);
      }
    });
  }

  prevPageAD() { if (this.pageAD() > 1) this.pageAD.update(v => v - 1); }
  nextPageAD() { if (this.pageAD() < this.totalPagesAD()) this.pageAD.update(v => v + 1); }

  prevPageLocal() { if (this.pageLocal() > 1) this.pageLocal.update(v => v - 1); }
  nextPageLocal() { if (this.pageLocal() < this.totalPagesLocal()) this.pageLocal.update(v => v + 1); }

  abrirModalAdmin(): void {
    const rolAdmin = this.roles().find(r => r.nombre.toLowerCase().includes('admin'));
    const idPorDefecto = rolAdmin ? rolAdmin.id : 1;

    this.nuevoAdmin.set({ username: '', email: '', password: '', origen_auth: 'LOCAL', rol_id: idPorDefecto });
    this.mostrarPasswordLocal.set(false);
    this.showAdminModal.set(true);
  }

  cerrarModalAdmin(): void {
    this.showAdminModal.set(false);
  }

  togglePasswordLocal(): void {
    this.mostrarPasswordLocal.update(v => !v);
  }

  prepararAgregarUsuario(user: any): void {
    this.usuarioSeleccionadoAD.set(user);
    this.tipoConfirmacion.set('AD');
    this.showConfirmModal.set(true);
  }

  cerrarConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.usuarioSeleccionadoAD.set(null);
  }
  prepararGuardarLocal(): void {
    const admin = this.nuevoAdmin();

    if (!admin.username || !admin.password) {
      alert('El usuario y la contraseña son obligatorios.');
      return;
    }

    this.tipoConfirmacion.set('LOCAL');
    this.showConfirmModal.set(true);
  }

  confirmarAccion(): void {
    if (this.tipoConfirmacion() === 'AD') {
      this.ejecutarAgregarAD();
    } else if (this.tipoConfirmacion() === 'LOCAL') {
      this.ejecutarGuardarLocal();
    } else {
      this.ejecutarCambioEstado();
    }
  }

  private ejecutarGuardarLocal(): void {
    this.cerrarConfirmModal();
    this.isSavingAdmin.set(true);

    const admin = this.nuevoAdmin();

    this.usuarioService.crearAdminLocal(admin).subscribe({
      next: () => {
        this.cerrarModalAdmin();
        this.cargarUsuariosLocales();
        this.isSavingAdmin.set(false);
      },
      error: (err) => {
        this.isSavingAdmin.set(false);
        alert(err.error?.error || 'Error al crear el usuario local.');
      }
    });
  }

  private ejecutarAgregarAD(): void {
    const user = this.usuarioSeleccionadoAD();

    if (!user)
      return;

    user.isSaving = true;
    this.cerrarConfirmModal();

    const newUsuario = {
      username: user.username,
      email: user.email,
      origen_auth: 'AD',
      rol_id: +user.selectedRole
    };

    this.usuarioService.crearUsuario(newUsuario).subscribe({
      next: () => {
        this.resultadosAD.update(list => list.filter(u => u.username !== user.username));
        this.cargarUsuariosLocales();
      },
      error: (err) => {
        console.log(err);
        user.isSaving = false;
        alert(err.error?.error || 'Error al agregar el usuario al sistema.');
      }
    });
  }

  prepararCambioEstado(usuario: any): void {
    this.usuarioSeleccionadoAD.set(usuario);
    this.tipoConfirmacion.set('ESTADO');
    this.showConfirmModal.set(true);
  }

  private ejecutarCambioEstado(): void {
    const user = this.usuarioSeleccionadoAD();

    if (!user)
      return;

    this.cerrarConfirmModal();

    const payload = {
      rol_id: user.rol_id,
      activo: !user.activo
    };

    this.usuarioService.actualizarUsuario(user.id, payload).subscribe({
      next: () => {
        this.cargarUsuariosLocales();
      },
      error: (err) => {
        alert(err.error?.error || 'Error al actualizar el estado del usuario.');
      }
    });
  }

  cerrarSesion() {
    this.authService.logout();
  }
}
