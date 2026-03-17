<?php

namespace Automattic\WooCommerce\Blocks\Payments\Integrations;

/**
 * Upay payment method integration
 *
 */
final class Upay extends AbstractPaymentMethodType {
    /**
     * Payment method name defined by payment methods extending this class.
     *
     * @var string
     */
    protected $name = 'upay';

    /**
     * Constructor
     *
     */
    public function __construct() {
    }

    /**
     * Initializes the payment method type.
     */
    public function initialize() {
        $this->settings = get_option( 'woocommerce_upay_settings', [] );
    }

    /**
     * Returns if this payment method should be active. If false, the scripts will not be enqueued.
     *
     * @return boolean
     */
    public function is_active() {
        return filter_var( $this->get_setting( 'enabled', false ), FILTER_VALIDATE_BOOLEAN );
    }

    /**
     * Returns an array of scripts/handles to be registered for this payment method.
     *
     * @return array
     */
    public function get_payment_method_script_handles() {
        wp_register_script( 'wc-payment-method-upay', WC_UPAY_PLUGIN_URL . '/woocommerce-blocks/wc-payment-method-upay.js', array(), WC_UPAY_VERSION, true);
        return [ 'wc-payment-method-upay' ];
    }

    /**
     * Returns an array of key=>value pairs of data made available to the payment methods script.
     *
     * @return array
     */
    public function get_payment_method_data() {
        return [
            'title'                     => $this->get_title(),
            'description'               => $this->get_description(),
            'icon'                      => $this->get_icon_image(),
            'show_icon'                 => $this->get_show_icon(),
            'upay_url'                  => $this->get_upay_url(),
            'upay_link_text'            => $this->get_upay_link_text(),
            'button_text'               => $this->get_button_text()
        ];
    }
    
    /**
     * Return the description.
     *
     * @return string
     */
    private function get_description() {
        $description = $this->get_setting( 'description' );
        if(isset($this->settings['testmode']) && 'yes' === $this->settings['testmode']){
            $description .= ' ' . __('SANDBOX ENABLED.', 'woocommerce-gateway-upay');
            $description = trim($description);
        }
        return $description;
    }
    
    /**
     * Return the title.
     *
     * @return string
     */
    public function get_title() {
        return $this->get_setting( 'title' );
    }
    
    /**
     * Return is icon.
     *
     * @return boolean
     */
    private function get_show_icon() {
        return isset( $this->settings['show_icon'] ) && 'yes' === $this->settings['show_icon'];
    }
    
    /**
     * Return is url.
     *
     * @return string||boolean
     */
    private function get_upay_url() {
        return isset( $this->settings['what_is_upay_url'] ) && $this->settings['what_is_upay_url'] ? $this->settings['what_is_upay_url'] : false;
    }
    
    /**
     * Return button text.
     *
     * @return string
     */
    private function get_button_text() {
        return isset( $this->settings['button_text'] ) && $this->settings['button_text'] ? $this->settings['button_text'] : __( 'Proceed to Upay', 'woocommerce-gateway-upay' );
    }
    
    /**
     * Return link text.
     *
     * @return string||boolean
     */
    private function get_upay_link_text() {
        return isset( $this->settings['what_is_upay_link_text'] ) && $this->settings['what_is_upay_link_text'] ? $this->settings['what_is_upay_link_text'] : false;
    }
    
    /**
     * Return image.
     *
     * @return string
     */
    private function get_icon_image() {
        return WC_UPAY_PLUGIN_URL . '/assets/images/upay.jpg';
    }
}
