import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  input,
} from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { mount, zoomOnDemand, type FigureData, type Model } from "isofig/runtime";

// El chip «Ampliar» descarga isofig/zoom solo cuando alguien lo pulsa.
zoomOnDemand(() => import("isofig/zoom"));

/** Lo que genera `isofig build <spec> --format module`. */
export interface CompiledFigure {
  id: string;
  html: string;
  data: FigureData;
}

@Component({
  selector: "isofig-figure",
  template: `<div class="isofig-host" [innerHTML]="html()"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class IsofigFigure {
  readonly figure = input.required<CompiledFigure>();
  readonly model = input<Model<any, any>>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly sanitizer = inject(DomSanitizer);
  private stop?: () => void;

  // El HTML sale del build de isofig a partir de una spec del propio proyecto, no de datos del usuario.
  protected readonly html = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.figure().html));

  constructor() {
    afterRenderEffect(() => {
      const figure = this.figure();
      const model = this.model();
      this.stop?.();
      const el = this.host.nativeElement.querySelector<HTMLElement>("[data-isofig]");
      this.stop = el ? mount(el, model, figure.data) : undefined;
    });
    inject(DestroyRef).onDestroy(() => this.stop?.());
  }
}
